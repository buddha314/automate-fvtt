/**
 * Automate FVTT — entry point.
 *
 * Phase 0: bootstrap + Fabricate handshake. Phase 1: Keep actor sub-type + sheet
 * + `keeps` API. Phase 2: world-time tick dispatcher + GM time-controls UI
 * (`api.time`), surfaced via a scene-control button and optional auto-open.
 * Phase 3: economy rules engine (`api.rules`) driven off the tick dispatcher.
 * Phase 4: Fabricate-backed rules — auto-harvest resource nodes and run recipes
 * as Keep converters, projecting Fabricate component inventory into the
 * stockpile through the adapter seam.
 * @module automate-fvtt
 */

import { MODULE_ID, KEEP_TYPE, HOOKS, SETTINGS, FABRICATE } from "./constants.js";
import { log } from "./logger.js";
import { registerSettings } from "./settings.js";
import { FabricateAdapter } from "./fabricate-adapter.js";
import { KeepModel } from "./data/keep-model.js";
import { KeepSheet } from "./apps/keep-sheet.js";
import { keepsApi, registerKeepHooks } from "./keep-api.js";
import { registerTickDispatcher, onTick } from "./time/tick-dispatcher.js";
import { formatWorldTime } from "./time/time-util.js";
import { TimeControls } from "./apps/time-controls.js";
import { registerRulesEngine, applyTick, configureFabricate } from "./rules/rule-engine.js";
import { listRules, registerRule, unregisterRule, computeTickPlan, setDelivery, DELIVERY } from "./rules/rules.js";
import { createComponentMap } from "./fabricate/component-map.js";
import { FAB_OP, makeFabricateRule } from "./fabricate/fabricate-rules.js";
import { registerBenefitEngine, registerBenefitPrompt, approveBenefit, invokeAction } from "./benefits/benefit-engine.js";
import { registerDefinition, unregisterDefinition, listDefinitions, bind, unbind } from "./benefits/benefit-store.js";
import { registerGenericCookbook, EXAMPLE_ROLES } from "./benefits/cookbook.js";
import { importBenefits, importPf2eKingmakerStructures } from "./benefits/importers.js";
import "./types.js"; // typedefs only

/**
 * Current Fabricate component ↔ stockpile resource mapping pairs, settable at
 * runtime via `api.rules.setComponentMap`. Rebuilds the engine's map in place.
 * @type {{componentId: string, resourceKey: string}[]}
 */
let componentMapPairs = [];

/**
 * Replace the component map the rules engine uses to project Fabricate inventory
 * into Keep stockpiles, re-injecting it alongside the current adapter.
 * @param {{componentId: string, resourceKey: string}[]} pairs
 */
function setComponentMap(pairs = []) {
  componentMapPairs = [...pairs];
  configureFabricate({
    adapter: state.fabricate,
    componentMap: createComponentMap(componentMapPairs),
  });
}

/**
 * Module-wide state, published at `game.modules.get(MODULE_ID).api`.
 * @type {{ fabricate: FabricateAdapter, ready: boolean, keeps: typeof keepsApi, time: object, rules: object }}
 */
const state = {
  fabricate: new FabricateAdapter(),
  ready: false,
  keeps: keepsApi,
  time: {
    open: () => TimeControls.open(),
    toggle: () => TimeControls.toggle(),
    onTick,
  },
  rules: {
    list: listRules,
    register: registerRule,
    unregister: unregisterRule,
    computeTickPlan,
    applyTick,
    /** Switch a producer between `keep` (direct) and `port` (routed) delivery. */
    setDelivery,
    /** Collect a Keep's port buffers into its stockpile (manual routing). */
    collectPorts: keepsApi.collectPorts,
    DELIVERY,
    // Phase 4 — Fabricate-backed rules.
    /** Build a harvest/craft rule that delegates its effect to Fabricate. */
    makeFabricateRule,
    /** Configure the Fabricate component ↔ stockpile resource mapping. */
    setComponentMap,
    FAB_OP,
  },
  /**
   * Membership benefits (Change A). Content registers definitions on
   * `automate-fvtt.ready`, binds them to Keeps, and the engine resolves them
   * event-driven. See `benefits/*`.
   */
  benefits: {
    register: registerDefinition,
    unregister: unregisterDefinition,
    list: listDefinitions,
    bind,
    unbind,
    /** Approve a live interactive benefit for a member, then re-resolve. */
    approve: (keepId, actorUuid, benefitId) => approveBenefit(keepsApi.get(keepId), actorUuid, benefitId),
    /** Invoke an action benefit (emits `automate-fvtt.benefitInvoked`). */
    invoke: (keepId, actorUuid, benefitId) => invokeAction(keepsApi.get(keepId), actorUuid, benefitId),
    /** Example role vocabularies (Decision 6) — opaque strings, adopt or replace. */
    exampleRoles: EXAMPLE_ROLES,
    /** Importer seam: convert license-permissive content into defs for GM review. */
    import: { custom: importBenefits, pf2eKingmakerStructures: importPf2eKingmakerStructures },
  },
};

Hooks.once("init", () => {
  log.info("Initializing Automate FVTT");
  registerSettings();

  // Keep actor sub-type + sheet (Phase 1).
  CONFIG.Actor.dataModels[KEEP_TYPE] = KeepModel;
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, MODULE_ID, KeepSheet, {
    types: [KEEP_TYPE],
    makeDefault: true,
    label: "AUTOMATE_FVTT.Keep.SheetLabel",
  });
  registerKeepHooks();

  // Membership benefits (Change A): event-driven resolver, sibling of the tick
  // engine. Re-resolves on membership/tier/scene change and the world-time
  // landing point; never participates in the tick.
  registerBenefitEngine();
  registerBenefitPrompt(); // GM chat-card prompt for interactive benefits

  // World-time tick dispatcher (Phase 2). A demo subscriber proves the fan-out.
  registerTickDispatcher();
  onTick("demo-log", ({ dt, worldTime }) =>
    log.debug(`demo tick: +${dt}s -> ${formatWorldTime(worldTime)}`)
  );

  // Economy rules engine (Phase 3): evaluates producers/consumers/upkeep/
  // converters against each Keep on every tick. Registered after the dispatcher.
  registerRulesEngine();

  // Add a scene-control button to toggle the time-controls panel (GM only).
  Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user?.isGM) return;
    const group = controls.tokens ?? Object.values(controls)[0];
    if (!group?.tools) return;
    group.tools["automate-fvtt-time"] = {
      name: "automate-fvtt-time",
      title: "AUTOMATE_FVTT.Time.Title",
      icon: "fa-solid fa-hourglass-half",
      button: true,
      onChange: () => TimeControls.toggle(),
    };
  });

  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = state;
});

Hooks.once("ready", () => {
  const ok = state.fabricate.handshake();
  state.ready = ok;

  // Phase 4: hand the (now-acquired) adapter to the rules engine so Fabricate-
  // backed rules can run. Identity component map until a world configures one.
  configureFabricate({
    adapter: state.fabricate,
    componentMap: createComponentMap(componentMapPairs),
  });

  // Seed the generic benefit cookbook as a reference/fallback (Change A, 6.1).
  // Content modules register their own on the same hook; idempotent by id.
  registerGenericCookbook();

  if (ok) log.info("Automate FVTT ready.");
  else if (game.user?.isGM) {
    log.notify(
      "warn",
      `Disabled — ${state.fabricate.unavailableReason ?? "Fabricate is unavailable."}`
    );
  }

  // Surface the time controls for the GM by default (configurable).
  if (game.user?.isGM && game.settings.get(MODULE_ID, SETTINGS.AUTO_OPEN_CONTROLS)) {
    TimeControls.open();
  }

  // Phase 4: seed any crafting systems this module ships (recipes + gathering
  // realms) into Fabricate. Idempotent, and only the primary GM writes so a
  // multi-client world imports once. Fire-and-forget; results are logged.
  if (ok && FABRICATE.SEED_SYSTEMS.length && isPrimaryGM()) {
    void seedFabricateSystems();
  }

  Hooks.callAll(HOOKS.READY, state.fabricate, ok);
});

/**
 * Is this client the single authoritative GM? Prefers Foundry's elected active
 * GM, falling back to plain GM. Keeps module-level side effects (like seeding a
 * Fabricate system) to one writer in a multi-client world.
 * @returns {boolean}
 */
function isPrimaryGM() {
  const users = game.users;
  if (users?.activeGM) return users.activeGM === game.user;
  return !!game.user?.isGM;
}

/**
 * Seed each configured crafting-system export into Fabricate, in order.
 * @returns {Promise<void>}
 */
async function seedFabricateSystems() {
  for (const path of FABRICATE.SEED_SYSTEMS) {
    const url = `modules/${MODULE_ID}/${path}`;
    try {
      const res = await state.fabricate.seedSystem(url);
      if (res.seeded) log.info(`Seeded Fabricate system from ${path} (${res.systemId}).`);
      else log.debug(`Fabricate seed skipped for ${path}: ${res.reason}.`);
    } catch (err) {
      log.error(`Fabricate seed failed for ${path}:`, err);
    }
  }
}

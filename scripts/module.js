/**
 * Automate FVTT — entry point.
 *
 * Phase 0: bootstrap + Fabricate handshake. Phase 1: Keep actor sub-type + sheet
 * + `keeps` API. Phase 2: world-time tick dispatcher + GM time-controls UI
 * (`api.time`), surfaced via a scene-control button and optional auto-open.
 * Phase 3: economy rules engine (`api.rules`) driven off the tick dispatcher.
 * @module automate-fvtt
 */

import { MODULE_ID, KEEP_TYPE, HOOKS, SETTINGS } from "./constants.js";
import { log } from "./logger.js";
import { registerSettings } from "./settings.js";
import { FabricateAdapter } from "./fabricate-adapter.js";
import { KeepModel } from "./data/keep-model.js";
import { KeepSheet } from "./apps/keep-sheet.js";
import { keepsApi, registerKeepHooks } from "./keep-api.js";
import { registerTickDispatcher, onTick } from "./time/tick-dispatcher.js";
import { formatWorldTime } from "./time/time-util.js";
import { TimeControls } from "./apps/time-controls.js";
import { registerRulesEngine, applyTick } from "./rules/rule-engine.js";
import { listRules, registerRule, unregisterRule, computeTickPlan } from "./rules/rules.js";
import "./types.js"; // typedefs only

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

  Hooks.callAll(HOOKS.READY, state.fabricate, ok);
});

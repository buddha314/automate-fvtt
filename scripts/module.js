/**
 * Automate FVTT — entry point.
 *
 * Phase 0: bootstrap (settings + logging) + Fabricate handshake at `ready`.
 * Phase 1: register the Keep actor sub-type (data model + sheet) and publish the
 * `keeps` CRUD API. On Fabricate failure the module still registers the Keep
 * machinery but degrades gracefully (warns, stays inert for crafting features).
 * @module automate-fvtt
 */

import { MODULE_ID, KEEP_TYPE, HOOKS } from "./constants.js";
import { log } from "./logger.js";
import { registerSettings } from "./settings.js";
import { FabricateAdapter } from "./fabricate-adapter.js";
import { KeepModel } from "./data/keep-model.js";
import { KeepSheet } from "./apps/keep-sheet.js";
import { keepsApi, registerKeepHooks } from "./keep-api.js";
import "./types.js"; // typedefs only

/**
 * Module-wide state, also published at `game.modules.get(MODULE_ID).api`.
 * @type {{ fabricate: FabricateAdapter, ready: boolean, keeps: typeof keepsApi }}
 */
const state = {
  fabricate: new FabricateAdapter(),
  ready: false,
  keeps: keepsApi,
};

Hooks.once("init", () => {
  log.info("Initializing Automate FVTT");
  registerSettings();

  // Register the Keep actor sub-type and its sheet.
  CONFIG.Actor.dataModels[KEEP_TYPE] = KeepModel;
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, MODULE_ID, KeepSheet, {
    types: [KEEP_TYPE],
    makeDefault: true,
    label: "AUTOMATE_FVTT.Keep.SheetLabel",
  });
  registerKeepHooks();

  // Publish the API surface early so it always exists, even if Fabricate is absent.
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = state;
});

Hooks.once("ready", () => {
  const ok = state.fabricate.handshake();
  state.ready = ok;

  if (ok) {
    log.info("Automate FVTT ready.");
  } else if (game.user?.isGM) {
    // Only nag the GM — players can't fix a missing dependency.
    log.notify(
      "warn",
      `Disabled — ${state.fabricate.unavailableReason ?? "Fabricate is unavailable."}`
    );
  }

  // Let later phases (and tests) react to the resolved handshake.
  Hooks.callAll(HOOKS.READY, state.fabricate, ok);
});

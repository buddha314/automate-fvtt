/**
 * Automate FVTT — entry point.
 *
 * Phase 0: bootstrap (settings + logging), then perform the Fabricate handshake
 * at `ready` and expose the module's public API on the module entry. On failure
 * the module degrades gracefully (warns, stays inert) rather than crashing.
 * @module automate-fvtt
 */

import { MODULE_ID, HOOKS } from "./constants.js";
import { log } from "./logger.js";
import { registerSettings } from "./settings.js";
import { FabricateAdapter } from "./fabricate-adapter.js";
import "./types.js"; // typedefs only

/**
 * Module-wide state, also published at `game.modules.get(MODULE_ID).api`.
 * @type {{ fabricate: FabricateAdapter, ready: boolean }}
 */
const state = {
  fabricate: new FabricateAdapter(),
  ready: false,
};

Hooks.once("init", () => {
  log.info("Initializing Automate FVTT");
  registerSettings();

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

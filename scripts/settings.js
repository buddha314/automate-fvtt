/**
 * Settings registration. Kept minimal for Phase 0 — just a debug toggle that
 * gates verbose logging. Later phases register their own keys here.
 * @module settings
 */

import { MODULE_ID, SETTINGS } from "./constants.js";

/** Register all module settings. Call once during `init`. */
export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.DEBUG, {
    name: "AUTOMATE_FVTT.Settings.Debug.Name",
    hint: "AUTOMATE_FVTT.Settings.Debug.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });
}

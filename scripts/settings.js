/**
 * Settings registration. Kept minimal for Phase 0 — just a debug toggle that
 * gates verbose logging. Later phases register their own keys here.
 * @module settings
 */

import { MODULE_ID, SETTINGS } from "./constants.js";
import { STEP_UNITS } from "./time/time-util.js";
import { DELIVERY } from "./rules/rules.js";

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

  game.settings.register(MODULE_ID, SETTINGS.TIME_STEP_UNIT, {
    name: "AUTOMATE_FVTT.Settings.StepUnit.Name",
    hint: "AUTOMATE_FVTT.Settings.StepUnit.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: Object.fromEntries(STEP_UNITS.map((u) => [u, u])),
    default: "day",
  });

  game.settings.register(MODULE_ID, SETTINGS.TIME_STEP_AMOUNT, {
    name: "AUTOMATE_FVTT.Settings.StepAmount.Name",
    hint: "AUTOMATE_FVTT.Settings.StepAmount.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 1,
  });

  game.settings.register(MODULE_ID, SETTINGS.AUTO_OPEN_CONTROLS, {
    name: "AUTOMATE_FVTT.Settings.AutoOpen.Name",
    hint: "AUTOMATE_FVTT.Settings.AutoOpen.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_PRODUCER_DELIVERY, {
    name: "AUTOMATE_FVTT.Settings.Delivery.Name",
    hint: "AUTOMATE_FVTT.Settings.Delivery.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      [DELIVERY.KEEP]: "AUTOMATE_FVTT.Settings.Delivery.Keep",
      [DELIVERY.PORT]: "AUTOMATE_FVTT.Settings.Delivery.Port",
    },
    default: DELIVERY.KEEP,
  });
}

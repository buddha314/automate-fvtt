/**
 * Module-wide constants for Automate FVTT.
 * @module constants
 */

/** Canonical module id; must match `id` in module.json. */
export const MODULE_ID = "automate-fvtt";

/** Human-readable title, used in notifications and log lines. */
export const MODULE_TITLE = "Automate FVTT";

/** Settings keys, kept in one place to avoid stringly-typed drift. */
export const SETTINGS = Object.freeze({
  DEBUG: "debug",
});

/**
 * Actor sub-type id for a Keep. Foundry namespaces module sub-types as
 * `<module-id>.<type>`, so this MUST match the `documentTypes.Actor` key in
 * module.json (`keep`).
 */
export const KEEP_TYPE = `${MODULE_ID}.keep`;

/** Default Keep portrait — temporary placeholder art for testing. */
export const KEEP_ICON = `modules/${MODULE_ID}/assets/icons/nuclear-plant.svg`;

/** Hooks this module emits, for other code (and later phases) to listen on. */
export const HOOKS = Object.freeze({
  /** Fired once after the Fabricate handshake resolves, with the FabricateAdapter. */
  READY: `${MODULE_ID}.ready`,
  /** Fired with (keep) whenever a Keep actor's stockpile or counts change. */
  KEEP_UPDATED: `${MODULE_ID}.keepUpdated`,
});

/**
 * Fabricate dependency. Fabricate exposes its API as `game.fabricate.api` and a
 * `game.fabricate` namespace during its own `init` hook, so we read it at `ready`.
 */
export const FABRICATE = Object.freeze({
  ID: "fabricate",
  /**
   * Known-good Fabricate version this module is developed and tested against.
   * Fabricate is pre-1.0 (1.0.0-rc line) with a shifting API, so a mismatch is a
   * warning, not a hard failure — but the seam in fabricate-adapter.js is where
   * breakage surfaces.
   */
  KNOWN_GOOD_VERSION: "1.0.0-rc.57",
});

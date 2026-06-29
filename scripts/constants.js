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
  /** Unit for the time controls "Next" button (hour|day|week|month|year). */
  TIME_STEP_UNIT: "timeStepUnit",
  /** Amount of TIME_STEP_UNIT advanced per "Next" press. */
  TIME_STEP_AMOUNT: "timeStepAmount",
  /** Auto-open the GM time controls panel on load. */
  AUTO_OPEN_CONTROLS: "autoOpenControls",
  /**
   * Default delivery mode for asset-bound producers that don't set their own:
   * `keep` deposits output straight into the Keep stockpile (adjacency optional),
   * `port` holds it in a buffer for belt routing (Phase 7).
   */
  DEFAULT_PRODUCER_DELIVERY: "defaultProducerDelivery",
});

/**
 * How a Keep is identified and stored.
 *
 * A Keep is a **core-type actor** (see {@link KEEP_ACTOR_TYPE_BY_SYSTEM}) carrying
 * our data under a single module flag, rather than a custom Actor sub-type. This
 * is deliberate: pf2e — the primary target system — rejects module-defined Actor
 * sub-types at `Actor.create` ("actor module subtypes are not supported"), so a
 * `<module-id>.keep` sub-type can't exist there. Backing Keeps with a core type +
 * flags is the one code path that works in every system.
 *
 * - `KEEP_FLAG` is the flag key (under scope `MODULE_ID`) holding the Keep ledger.
 * - `KEEP_DATA_PATH` is the document-update path prefix for that flag object.
 */
export const KEEP_FLAG = "keep";

/** Update-path prefix for a Keep's flag data, e.g. `${KEEP_DATA_PATH}.stockpile.ore`. */
export const KEEP_DATA_PATH = `flags.${MODULE_ID}.${KEEP_FLAG}`;

/**
 * Preferred core Actor type to back a Keep, per game system. pf2e's `loot` is a
 * lightweight item-container actor (a natural warehouse); dnd5e's `npc` is a safe
 * generic. Unlisted systems fall back to a generic type at runtime
 * (see `pickKeepActorType` in keep-api).
 */
export const KEEP_ACTOR_TYPE_BY_SYSTEM = Object.freeze({
  pf2e: "loot",
  dnd5e: "npc",
});

/** Default Keep portrait — temporary placeholder art for testing. */
export const KEEP_ICON = `modules/${MODULE_ID}/assets/icons/nuclear-plant.svg`;

/** Hooks this module emits, for other code (and later phases) to listen on. */
export const HOOKS = Object.freeze({
  /** Fired once after the Fabricate handshake resolves, with the FabricateAdapter. */
  READY: `${MODULE_ID}.ready`,
  /** Fired with (keep) whenever a Keep actor's stockpile or counts change. */
  KEEP_UPDATED: `${MODULE_ID}.keepUpdated`,
  /** Fired with ({worldTime, dt, prevTime}) on every world-time advance. */
  TICK: `${MODULE_ID}.tick`,
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
  KNOWN_GOOD_VERSION: "1.0.0-rc.87",
  /**
   * Crafting-system export JSONs (Fabricate "Export System" payloads) this module
   * ships and seeds into Fabricate on `ready`, idempotently. Each entry is a path
   * **relative to the module root** under `data/fabricate/`; the engine resolves
   * it to `modules/automate-fvtt/<path>`. Author the system once in Fabricate's
   * UI, Export System → JSON, drop it in `data/fabricate/`, and list it here.
   * @type {string[]}
   */
  SEED_SYSTEMS: ["data/fabricate/keep-economy.json"],
});

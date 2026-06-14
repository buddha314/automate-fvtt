/**
 * The single seam between Automate FVTT and Fabricate.
 *
 * Every later phase MUST go through this adapter rather than touching
 * `game.fabricate` directly, so that when Fabricate's pre-1.0 API shifts, the
 * breakage is localized here. The adapter detects Fabricate, acquires its API,
 * version-checks against the known-good pin, and exposes a small typed surface.
 *
 * Fabricate publishes `game.fabricate` and `game.fabricate.api` during its own
 * `init` hook, so the handshake runs at `ready` (after all module inits).
 * @module fabricate-adapter
 */

import { FABRICATE } from "./constants.js";
import { log } from "./logger.js";

export class FabricateAdapter {
  /** @type {boolean} */
  #available = false;
  /** @type {string|null} */
  #version = null;
  /** @type {object|null} Fabricate's public API object (`game.fabricate.api`). */
  #api = null;
  /** @type {object|null} Fabricate's top-level namespace (`game.fabricate`). */
  #ns = null;
  /** @type {string|null} Human-readable reason the adapter is unavailable. */
  #unavailableReason = null;

  /** @returns {boolean} true when Fabricate is present, active, and its API was acquired. */
  get available() {
    return this.#available;
  }

  /** @returns {string|null} the detected Fabricate version, or null. */
  get version() {
    return this.#version;
  }

  /** @returns {string|null} why the adapter is unavailable, or null when available. */
  get unavailableReason() {
    return this.#unavailableReason;
  }

  /**
   * Run the detect → acquire → version-check handshake. Idempotent and never
   * throws: on any failure it records a reason and leaves `available` false.
   * @returns {boolean} the resulting availability.
   */
  handshake() {
    this.#available = false;
    this.#api = this.#ns = this.#version = this.#unavailableReason = null;

    const mod = game.modules?.get(FABRICATE.ID);
    if (!mod) {
      return this.#fail("Fabricate module is not installed.");
    }
    if (!mod.active) {
      return this.#fail("Fabricate module is installed but not enabled.");
    }

    // Fabricate sets `game.fabricate` (+ `.api`) during its init hook.
    const ns = game.fabricate ?? globalThis.fabricate ?? null;
    const api = ns?.api ?? null;
    if (!ns || !api) {
      return this.#fail(
        "Fabricate is active but its API was not found on `game.fabricate.api` " +
          "(load-order or version issue)."
      );
    }

    this.#ns = ns;
    this.#api = api;
    this.#version = mod.version ?? null;
    this.#available = true;

    this.#checkVersion(mod.version);
    log.info(
      `Fabricate handshake OK — version ${this.#version ?? "unknown"}, API acquired.`
    );
    return true;
  }

  /**
   * Fabricate's public API object. Throws if unavailable — callers in later
   * phases should guard with `available` or catch and degrade.
   * @returns {object}
   */
  requireApi() {
    if (!this.#available || !this.#api) {
      throw new Error(
        `[${FABRICATE.ID}] API unavailable: ${this.#unavailableReason ?? "not acquired"}`
      );
    }
    return this.#api;
  }

  /** @returns {object|null} the API object, or null when unavailable (non-throwing). */
  getApi() {
    return this.#api;
  }

  /** @returns {object|null} the `game.fabricate` namespace, or null. */
  getNamespace() {
    return this.#ns;
  }

  /* ---------------------------------------------------------------- */
  /* Phase 4 operation surface                                        */
  /*                                                                  */
  /* Thin, defensive wrappers over Fabricate's pre-1.0 API. Method    */
  /* names there are still shifting (the module is mid-rename at the  */
  /* 1.0.0-rc line), so each call **resolves the live method by name  */
  /* at call time** across the namespace and the api object, and      */
  /* degrades to a logged no-op rather than throwing when a method    */
  /* is absent. This is the single place that needs touching when the */
  /* upstream API settles — see the known signatures in the           */
  /* dependency-strategy notes (fabricate#345).                       */
  /* ---------------------------------------------------------------- */

  /**
   * Find the first callable among `names` on the api object then the namespace.
   * @param {string[]} names  candidate method names, most-preferred first
   * @returns {?{fn: Function, ctx: object, name: string}}
   */
  #resolve(names) {
    for (const host of [this.#api, this.#ns]) {
      if (!host) continue;
      for (const name of names) {
        if (typeof host[name] === "function") return { fn: host[name], ctx: host, name };
      }
    }
    return null;
  }

  /**
   * Read a Fabricate component inventory off an actor as a flat
   * componentId → quantity map — the input to the stockpile projection in
   * {@link module:fabricate/component-map}. Falls back to scanning the actor's
   * own Items for a Fabricate component flag when no inventory API is exposed.
   * @param {Actor} actor
   * @returns {Object<string, number>} componentId → quantity (empty when unavailable)
   */
  readInventory(actor) {
    if (!this.#available || !actor) return {};
    try {
      const m = this.#resolve(["getInventory", "inventory", "readInventory"]);
      if (m) {
        const inv = m.fn.call(m.ctx, actor);
        return this.#normalizeInventory(inv);
      }
      // Fallback: components are real Items carrying a fabricate flag.
      const out = {};
      for (const item of actor.items ?? []) {
        const cid =
          item.getFlag?.(FABRICATE.ID, "componentId") ??
          item.flags?.[FABRICATE.ID]?.componentId;
        if (!cid) continue;
        out[cid] = (out[cid] ?? 0) + (Number(item.system?.quantity ?? 1) || 0);
      }
      return out;
    } catch (err) {
      log.warn(`Fabricate readInventory failed: ${err?.message ?? err}`);
      return {};
    }
  }

  /**
   * Coerce whatever the inventory API returns (Map, array of {id,quantity},
   * or plain object) into a componentId → qty record.
   * @param {*} inv
   * @returns {Object<string, number>}
   */
  #normalizeInventory(inv) {
    const out = {};
    if (!inv) return out;
    const add = (id, qty) => {
      if (!id) return;
      out[id] = (out[id] ?? 0) + (Number(qty ?? 1) || 0);
    };
    if (inv instanceof Map) {
      for (const [id, qty] of inv) add(id, qty);
    } else if (Array.isArray(inv)) {
      for (const e of inv) add(e?.id ?? e?.componentId, e?.quantity ?? e?.qty);
    } else if (typeof inv === "object") {
      for (const [id, qty] of Object.entries(inv)) add(id, qty);
    }
    return out;
  }

  /**
   * Auto-resolve gathering on a Fabricate resource node, depositing the yield on
   * `actor` (the Keep). Reuses Fabricate's own world-time node respawn — we only
   * pull the currently-available yield, we do not roll our own respawn clock.
   * @param {object} args
   * @param {string} args.nodeId
   * @param {Actor} args.actor  the Keep to deposit into
   * @returns {Promise<boolean>} true if a harvest was attempted
   */
  async harvest({ nodeId, actor } = {}) {
    if (!this.#available || !nodeId || !actor) return false;
    const m = this.#resolve(["harvest", "gather", "gatherNode", "harvestNode"]);
    if (!m) {
      log.warn(`Fabricate exposes no harvest method; node "${nodeId}" not gathered.`);
      return false;
    }
    try {
      await m.fn.call(m.ctx, { nodeId, actor, gatheringActor: actor });
      return true;
    } catch (err) {
      log.warn(`Fabricate harvest of node "${nodeId}" failed: ${err?.message ?? err}`);
      return false;
    }
  }

  /**
   * Run a Fabricate recipe with the Keep as the crafting actor, so outputs land
   * in the Keep's inventory. Mirrors the documented
   * `craft(actor, recipeId, { componentSourceActors, ingredientSetId })` shape.
   * @param {object} args
   * @param {string} args.recipeId
   * @param {Actor} args.actor  crafting actor (the Keep) — also the default ingredient source
   * @param {Actor[]} [args.sourceActors]  where ingredients are drawn from (defaults to `[actor]`)
   * @param {string} [args.ingredientSetId]
   * @returns {Promise<boolean>} true if a craft was attempted
   */
  async craft({ recipeId, actor, sourceActors, ingredientSetId } = {}) {
    if (!this.#available || !recipeId || !actor) return false;
    const m = this.#resolve(["craft", "craftRecipe", "doCraft"]);
    if (!m) {
      log.warn(`Fabricate exposes no craft method; recipe "${recipeId}" not run.`);
      return false;
    }
    try {
      await m.fn.call(m.ctx, actor, recipeId, {
        componentSourceActors: sourceActors ?? [actor],
        ingredientSetId,
      });
      return true;
    } catch (err) {
      log.warn(`Fabricate craft of recipe "${recipeId}" failed: ${err?.message ?? err}`);
      return false;
    }
  }

  /**
   * Warn (do not fail) when the detected version differs from the known-good pin.
   * @param {string|undefined} actual
   */
  #checkVersion(actual) {
    if (!actual) return;
    const known = FABRICATE.KNOWN_GOOD_VERSION;
    const isNewer = foundry?.utils?.isNewerVersion;
    if (typeof isNewer !== "function") return;
    if (isNewer(actual, known)) {
      log.warn(
        `Fabricate ${actual} is newer than the tested ${known}; API drift is ` +
          `possible — verify behaviour and update KNOWN_GOOD_VERSION.`
      );
    } else if (isNewer(known, actual)) {
      log.warn(
        `Fabricate ${actual} is older than the tested ${known}; some features ` +
          `may be missing.`
      );
    }
  }

  /**
   * @param {string} reason
   * @returns {false}
   */
  #fail(reason) {
    this.#unavailableReason = reason;
    log.warn(reason);
    return false;
  }
}

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

  /* ---------------------------------------------------------------- */
  /* Crafting-system seeding (provide Fabricate with recipes/nodes)   */
  /*                                                                  */
  /* Fabricate can export a whole crafting system — essences,         */
  /* components, recipes, and gathering realms — to a JSON envelope    */
  /* `{ fabricateVersion, exportedAt, system, recipes }`, and import   */
  /* it back via `game.fabricate.importSystemFromFile`, which accepts  */
  /* a raw JSON STRING (no file picker). So a module can ship that     */
  /* JSON and seed it on load. Confirmed against Fabricate 1.0.0-rc.87 */
  /* (src/systems/CraftingSystemExporter.js). Canvas node *placements* */
  /* live on Scenes/tiles and ship separately as a scene pack.         */
  /* ---------------------------------------------------------------- */

  /** @returns {object|null} Fabricate's crafting-system manager, or null. */
  getCraftingSystemManager() {
    if (!this.#available) return null;
    try {
      return this.#ns?.getCraftingSystemManager?.() ?? null;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} systemId
   * @returns {object|null} the crafting system with this id, or null if absent.
   */
  getSystem(systemId) {
    try {
      return this.getCraftingSystemManager()?.getSystem?.(systemId) ?? null;
    } catch {
      return null;
    }
  }

  /** @returns {object[]} all crafting systems Fabricate currently knows. */
  listSystems() {
    try {
      return this.getCraftingSystemManager()?.getSystems?.() ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Validate a parsed export envelope against Fabricate's own checker.
   * @param {object} data  parsed export JSON
   * @returns {{valid: boolean, errors: string[], warnings: string[]}}
   */
  validateImportData(data) {
    const exporter = this.#api?.CraftingSystemExporter;
    if (typeof exporter?.validateImportData !== "function") {
      return { valid: true, errors: [], warnings: ["validator unavailable"] };
    }
    try {
      return exporter.validateImportData(data);
    } catch (err) {
      return { valid: false, errors: [String(err?.message ?? err)], warnings: [] };
    }
  }

  /**
   * Serialize an existing crafting system to its export envelope (the JSON you'd
   * commit and ship). Mirrors Fabricate's "Export System".
   * @param {string} systemId
   * @returns {object|null} export payload, or null when unavailable.
   */
  exportSystem(systemId) {
    if (!this.#available) return null;
    try {
      return this.#ns?.exportSystem?.(systemId) ?? null;
    } catch (err) {
      log.warn(`Fabricate exportSystem("${systemId}") failed: ${err?.message ?? err}`);
      return null;
    }
  }

  /**
   * Import a crafting system from an export envelope — the low-level wrapper
   * around `game.fabricate.importSystemFromFile`, which takes a raw JSON string.
   * @param {string|object} jsonOrData  export JSON as a string, or a parsed object
   * @param {object} [options]
   * @param {boolean} [options.overwriteExisting=false]  replace matching docs
   * @param {boolean} [options.copyMode=false]  import under fresh ids instead of preserving them
   * @returns {Promise<object|null>} importer result ({added, updated, skipped, …}) or null.
   */
  async importSystem(jsonOrData, { overwriteExisting = false, copyMode = false } = {}) {
    if (!this.#available) return null;
    const fn = this.#ns?.importSystemFromFile;
    if (typeof fn !== "function") {
      log.warn("Fabricate exposes no importSystemFromFile; cannot seed system.");
      return null;
    }
    const text = typeof jsonOrData === "string" ? jsonOrData : JSON.stringify(jsonOrData);
    try {
      return await fn.call(this.#ns, text, { overwriteExisting, copyMode });
    } catch (err) {
      log.warn(`Fabricate importSystem failed: ${err?.message ?? err}`);
      return null;
    }
  }

  /**
   * Idempotently seed a crafting system from a JSON export the module ships.
   * Fetches `url`, derives the system id from the payload, and — unless the
   * system already exists (and `overwriteExisting` is false) — imports it. Safe
   * to call on every `ready`; an already-present system is skipped, not duplicated.
   *
   * @param {string} url  module-relative path, e.g.
   *   `modules/automate-fvtt/data/fabricate/keep-economy.json`
   * @param {object} [options]
   * @param {boolean} [options.overwriteExisting=false]
   * @returns {Promise<{seeded: boolean, reason?: string, systemId?: string, result?: object}>}
   */
  async seedSystem(url, { overwriteExisting = false } = {}) {
    if (!this.#available) return { seeded: false, reason: "fabricate-unavailable" };
    let data;
    try {
      data = await foundry.utils.fetchJsonWithTimeout(url);
    } catch (err) {
      log.warn(`seedSystem: could not load "${url}": ${err?.message ?? err}`);
      return { seeded: false, reason: "fetch-failed" };
    }

    const systemId = data?.system?.id ?? null;
    const systemName = data?.system?.name ?? systemId ?? "(unnamed)";

    if (systemId && this.getSystem(systemId) && !overwriteExisting) {
      log.debug(`seedSystem: "${systemName}" (${systemId}) already present — skipping.`);
      return { seeded: false, reason: "already-present", systemId };
    }

    const { valid, errors, warnings } = this.validateImportData(data);
    for (const w of warnings ?? []) log.warn(`seedSystem("${systemName}"): ${w}`);
    if (!valid) {
      log.warn(`seedSystem: "${url}" failed validation: ${(errors ?? []).join("; ")}`);
      return { seeded: false, reason: "invalid", systemId };
    }

    const result = await this.importSystem(data, { overwriteExisting });
    if (!result) return { seeded: false, reason: "import-failed", systemId };
    log.info(`seedSystem: imported "${systemName}" (${systemId ?? "?"}).`);
    return { seeded: true, systemId, result };
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

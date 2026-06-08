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

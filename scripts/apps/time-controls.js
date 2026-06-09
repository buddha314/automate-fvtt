/**
 * GM time-controls panel (Phase 2). A small ApplicationV2 window — not a document
 * sheet — that shows the current world time and drives `game.time.advance()`:
 * a configurable "Next" button, preset jumps, and a custom amount/unit advance.
 *
 * Every advance flows through core world time, so the tick dispatcher (and any
 * registered economy rules) react automatically.
 * @module apps/time-controls
 */

import { MODULE_ID, SETTINGS, HOOKS } from "./../constants.js";
import { SECONDS, STEP_UNITS, toSeconds, formatWorldTime } from "./../time/time-util.js";
import { log } from "./../logger.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TimeControls extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Singleton instance so the scene-control button toggles one window. */
  static #instance = null;

  /** @returns {TimeControls} the shared instance. */
  static get instance() {
    return (this.#instance ??= new this());
  }

  /** Open (or focus) the panel. GM only. */
  static open() {
    if (!game.user?.isGM) return null;
    const app = this.instance;
    app.render(true);
    return app;
  }

  /** Toggle the panel open/closed. */
  static toggle() {
    const app = this.instance;
    if (app.rendered) app.close();
    else this.open();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "automate-fvtt-time-controls",
    classes: ["automate-fvtt-time"],
    tag: "div",
    position: { width: 320, height: "auto" },
    window: {
      title: "AUTOMATE_FVTT.Time.Title",
      icon: "fa-solid fa-hourglass-half",
      resizable: false,
    },
    actions: {
      next: TimeControls.#onNext,
      preset: TimeControls.#onPreset,
      custom: TimeControls.#onCustom,
    },
  };

  /** @override */
  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/time-controls.hbs` },
  };

  /** @override */
  async _prepareContext() {
    const unit = game.settings.get(MODULE_ID, SETTINGS.TIME_STEP_UNIT);
    const amount = game.settings.get(MODULE_ID, SETTINGS.TIME_STEP_AMOUNT);
    return {
      now: formatWorldTime(),
      worldSeconds: game.time?.worldTime ?? 0,
      stepLabel: `${amount} ${unit}${amount === 1 ? "" : "s"}`,
      presets: STEP_UNITS.map((u) => ({ unit: u, label: u })),
      units: STEP_UNITS.map((u) => ({ value: u, selected: u === unit })),
      customAmount: amount,
    };
  }

  /** Re-render whenever world time changes so the readout stays live. */
  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!this.#hooked) {
      this.#tickHookId = Hooks.on(HOOKS.TICK, () => this.render({ parts: ["body"] }));
      this.#hooked = true;
    }
  }

  /** @override */
  _onClose(options) {
    super._onClose?.(options);
    if (this.#hooked) {
      Hooks.off(HOOKS.TICK, this.#tickHookId);
      this.#hooked = false;
    }
  }

  #hooked = false;
  #tickHookId = null;

  /**
   * Advance world time by `seconds`, guarding against accidental negative jumps
   * past time zero.
   * @param {number} seconds
   */
  static async #advance(seconds) {
    if (!game.user?.isGM) return;
    if (!Number.isFinite(seconds) || seconds === 0) return;
    const target = (game.time?.worldTime ?? 0) + seconds;
    if (target < 0) {
      ui.notifications?.warn(game.i18n.localize("AUTOMATE_FVTT.Time.NoNegative"));
      return;
    }
    await game.time.advance(seconds);
    log.debug(`advanced world time by ${seconds}s -> ${game.time.worldTime}`);
  }

  /** "Next" — advance by the configured step. @this {TimeControls} */
  static async #onNext() {
    const unit = game.settings.get(MODULE_ID, SETTINGS.TIME_STEP_UNIT);
    const amount = game.settings.get(MODULE_ID, SETTINGS.TIME_STEP_AMOUNT);
    await TimeControls.#advance(toSeconds(unit, amount));
  }

  /** Preset jump (+1 unit), or a rewind when shift-clicked. */
  static async #onPreset(event, target) {
    const unit = target.dataset.unit;
    const sign = event?.shiftKey ? -1 : 1;
    await TimeControls.#advance(sign * (SECONDS[unit] ?? 0));
  }

  /** Custom amount + unit from the form fields. @this {TimeControls} */
  static async #onCustom() {
    const root = this.element;
    const unit = root.querySelector("[name=customUnit]")?.value;
    const amount = Number(root.querySelector("[name=customAmount]")?.value);
    await TimeControls.#advance(toSeconds(unit, amount));
  }
}

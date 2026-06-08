/**
 * Tiny structured logger. All output is prefixed so it is greppable in the
 * Foundry console as `automate-fvtt | ...`. Debug lines are gated behind the
 * module's debug setting (see settings.js); warn/error always emit.
 * @module logger
 */

import { MODULE_ID, MODULE_TITLE, SETTINGS } from "./constants.js";

const PREFIX = `${MODULE_ID} |`;

/** @returns {boolean} whether verbose debug logging is enabled. */
function debugEnabled() {
  try {
    return game.settings?.get(MODULE_ID, SETTINGS.DEBUG) === true;
  } catch (_e) {
    // Settings not registered yet (very early init) — stay quiet.
    return false;
  }
}

export const log = {
  /** Verbose; only printed when the debug setting is on. */
  debug(...args) {
    if (debugEnabled()) console.debug(PREFIX, ...args);
  },
  info(...args) {
    console.log(PREFIX, ...args);
  },
  warn(...args) {
    console.warn(PREFIX, ...args);
  },
  error(...args) {
    console.error(PREFIX, ...args);
  },
  /**
   * Surface a message to the GM via the UI as well as the console.
   * @param {"info"|"warn"|"error"} level
   * @param {string} message  Already-localized text.
   */
  notify(level, message) {
    this[level === "info" ? "info" : level](message);
    const notifier = ui?.notifications;
    if (!notifier) return;
    if (level === "error") notifier.error(`${MODULE_TITLE}: ${message}`);
    else if (level === "warn") notifier.warn(`${MODULE_TITLE}: ${message}`);
    else notifier.info(`${MODULE_TITLE}: ${message}`);
  },
};

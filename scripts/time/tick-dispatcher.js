/**
 * The single world-time tick dispatcher.
 *
 * Listens to Foundry's core `updateWorldTime` hook and fans the delta out to
 * registered subscribers, then emits the module `tick` hook. This is the one
 * place economy rules (Phase 3) and the time controls hang off, so time advanced
 * from *any* source — GM buttons, a calendar module, the future cron — drives
 * everything uniformly.
 * @module time/tick-dispatcher
 */

import { HOOKS } from "./../constants.js";
import { log } from "./../logger.js";

/**
 * @typedef {Object} TickContext
 * @property {number} worldTime  new world time, seconds
 * @property {number} dt         delta since previous tick, seconds (may be negative)
 * @property {number} prevTime   previous world time, seconds
 */

/** @type {Map<string, (ctx: TickContext) => void>} */
const subscribers = new Map();

/**
 * Register (or replace) a tick subscriber.
 * @param {string} id  stable id; re-registering with the same id replaces it
 * @param {(ctx: TickContext) => void} callback
 */
export function onTick(id, callback) {
  subscribers.set(id, callback);
}

/** Remove a tick subscriber. @param {string} id */
export function offTick(id) {
  subscribers.delete(id);
}

/**
 * Wire the dispatcher to core world time. Call once during init/ready.
 */
export function registerTickDispatcher() {
  Hooks.on("updateWorldTime", (worldTime, dt) => {
    const ctx = { worldTime, dt, prevTime: worldTime - dt };
    log.debug(`tick: worldTime=${worldTime} dt=${dt} (${subscribers.size} subs)`);
    for (const [id, cb] of subscribers) {
      try {
        cb(ctx);
      } catch (err) {
        log.error(`tick subscriber "${id}" threw:`, err);
      }
    }
    Hooks.callAll(HOOKS.TICK, ctx);
  });
}

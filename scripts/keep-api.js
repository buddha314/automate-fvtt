/**
 * CRUD surface for Keep actors. Published at
 * `game.modules.get("automate-fvtt").api.keeps`.
 *
 * All mutators go through the Actor document so persistence, permissions, and
 * undo come for free; the `automate-fvtt.keepUpdated` hook is emitted centrally
 * from an `updateActor` listener (see {@link registerKeepHooks}) so both API and
 * sheet edits notify listeners.
 * @module keep-api
 */

import { KEEP_TYPE, KEEP_ICON, HOOKS } from "./constants.js";
import { log } from "./logger.js";

/** @returns {Actor[]} all Keep actors in the world. */
export function listKeeps() {
  return game.actors?.filter((a) => a.type === KEEP_TYPE) ?? [];
}

/**
 * @param {string} id  Actor id.
 * @returns {Actor|null} the Keep with this id, or null if missing/not a Keep.
 */
export function getKeep(id) {
  const actor = game.actors?.get(id) ?? null;
  return actor?.type === KEEP_TYPE ? actor : null;
}

/**
 * @param {string} sceneId
 * @returns {Actor|null} the Keep that owns the given scene, if any.
 */
export function getSceneKeep(sceneId) {
  return listKeeps().find((k) => k.system.sceneId === sceneId) ?? null;
}

/**
 * Create a new Keep actor.
 * @param {object} [data]
 * @param {string} [data.name="New Keep"]
 * @param {?string} [data.sceneId=null]
 * @param {object} [data.stockpile]  resource → qty
 * @param {object} [data.counts]     { henchmen, garden }
 * @returns {Promise<Actor>}
 */
export async function createKeep({ name = "New Keep", sceneId = null, stockpile = {}, counts = {}, img = KEEP_ICON } = {}) {
  const actor = await Actor.create({
    name,
    type: KEEP_TYPE,
    img,
    system: { sceneId, stockpile, counts },
  });
  log.debug(`Created Keep "${name}" (${actor?.id}).`);
  return actor;
}

/**
 * Set a resource quantity (creating the entry if needed).
 * @param {Actor|string} keepOrId
 * @param {string} resource
 * @param {number} qty
 * @returns {Promise<Actor>}
 */
export async function setResource(keepOrId, resource, qty) {
  const keep = resolveKeep(keepOrId);
  await keep.update({ [`system.stockpile.${resource}`]: Math.max(0, Number(qty) || 0) });
  return keep;
}

/**
 * Add `delta` (may be negative) to a resource, clamped at zero.
 * @param {Actor|string} keepOrId
 * @param {string} resource
 * @param {number} delta
 * @returns {Promise<Actor>}
 */
export async function adjustResource(keepOrId, resource, delta) {
  const keep = resolveKeep(keepOrId);
  const current = Number(keep.system.stockpile?.[resource] ?? 0);
  return setResource(keep, resource, current + (Number(delta) || 0));
}

/**
 * Remove a resource entry entirely.
 * @param {Actor|string} keepOrId
 * @param {string} resource
 * @returns {Promise<Actor>}
 */
export async function removeResource(keepOrId, resource) {
  const keep = resolveKeep(keepOrId);
  await keep.update({ [`system.stockpile.-=${resource}`]: null });
  return keep;
}

/**
 * Set a count-based config scalar (henchmen | garden).
 * @param {Actor|string} keepOrId
 * @param {"henchmen"|"garden"} key
 * @param {number} value
 * @returns {Promise<Actor>}
 */
export async function setCount(keepOrId, key, value) {
  const keep = resolveKeep(keepOrId);
  await keep.update({ [`system.counts.${key}`]: Math.max(0, Math.floor(Number(value) || 0)) });
  return keep;
}

/**
 * @param {Actor|string} keepOrId
 * @returns {Actor}
 * @throws if the argument does not resolve to a Keep actor.
 */
function resolveKeep(keepOrId) {
  const keep = typeof keepOrId === "string" ? getKeep(keepOrId) : keepOrId;
  if (!keep || keep.type !== KEEP_TYPE) {
    throw new Error(`[automate-fvtt] Not a Keep actor: ${keepOrId?.id ?? keepOrId}`);
  }
  return keep;
}

/**
 * Wire the central `keepUpdated` emitter. Call once during init/ready.
 */
export function registerKeepHooks() {
  Hooks.on("updateActor", (actor, changed) => {
    if (actor.type !== KEEP_TYPE) return;
    // Only re-emit when our economy-relevant fields changed.
    if (foundry.utils.hasProperty(changed, "system")) {
      Hooks.callAll(HOOKS.KEEP_UPDATED, actor);
    }
  });
}

/** The public keeps API object. */
export const keepsApi = {
  create: createKeep,
  list: listKeeps,
  get: getKeep,
  getForScene: getSceneKeep,
  setResource,
  adjustResource,
  removeResource,
  setCount,
};

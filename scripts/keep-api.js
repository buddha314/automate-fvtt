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
import { getMemberModifier as resolveMemberModifier, getMemberCapabilities } from "./benefits/benefit-engine.js";

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
 * Move resources held in a Keep's port buffers into its stockpile — the manual
 * collection path for producers using `port` delivery, until belt routing
 * (Phase 7) drains them automatically. Adds each buffered amount to the matching
 * stockpile resource and clears the drained buffers.
 * @param {Actor|string} keepOrId
 * @param {?string} [bufferKey=null]  collect only this buffer; null collects all
 * @returns {Promise<Actor>}
 */
export async function collectPorts(keepOrId, bufferKey = null) {
  const keep = resolveKeep(keepOrId);
  const buffers = keep.system?.buffers ?? {};
  const keys = bufferKey ? [bufferKey] : Object.keys(buffers);
  const update = {};

  for (const key of keys) {
    const held = buffers[key];
    if (!held) continue;
    for (const [res, qty] of Object.entries(held)) {
      const amount = Number(qty) || 0;
      if (amount <= 0) continue;
      const path = `system.stockpile.${res}`;
      const base = update[path] ?? Number(keep.system?.stockpile?.[res] ?? 0);
      update[path] = base + amount;
    }
    update[`system.buffers.-=${key}`] = null; // clear the drained buffer
  }

  if (Object.keys(update).length) await keep.update(update);
  return keep;
}

/* --------------------------- membership (Change A) --------------------------- */

/**
 * Find a member entry on a Keep by the referenced Actor's UUID.
 * @param {Actor} keep
 * @param {string} actorUuid
 * @returns {{actorUuid: string, role: string, joinedAt: ?number}|undefined}
 */
function findMember(keep, actorUuid) {
  return (keep.system?.members ?? []).find((m) => m.actorUuid === actorUuid);
}

/**
 * Add an existing Actor to a Keep's roster with a role. Does not create an Actor;
 * re-adding an already-present member is a no-op. Roles are opaque strings.
 * @param {Actor|string} keepOrId
 * @param {string} actorUuid  UUID of an existing PC/NPC Actor
 * @param {string} [role="member"]
 * @returns {Promise<Actor>}
 */
export async function addMember(keepOrId, actorUuid, role = "member") {
  const keep = resolveKeep(keepOrId);
  if (!actorUuid) throw new Error("[automate-fvtt] addMember needs an actorUuid");
  if (findMember(keep, actorUuid)) return keep; // idempotent
  const members = [...(keep.system?.members ?? []), { actorUuid, role, joinedAt: game.time?.worldTime ?? null }];
  await keep.update({ "system.members": members });
  return keep;
}

/**
 * Remove a member from a Keep's roster. The referenced Actor is left untouched.
 * @param {Actor|string} keepOrId
 * @param {string} actorUuid
 * @returns {Promise<Actor>}
 */
export async function removeMember(keepOrId, actorUuid) {
  const keep = resolveKeep(keepOrId);
  const members = (keep.system?.members ?? []).filter((m) => m.actorUuid !== actorUuid);
  await keep.update({ "system.members": members });
  return keep;
}

/**
 * Change a member's role.
 * @param {Actor|string} keepOrId
 * @param {string} actorUuid
 * @param {string} role
 * @returns {Promise<Actor>}
 */
export async function setMemberRole(keepOrId, actorUuid, role) {
  const keep = resolveKeep(keepOrId);
  const members = (keep.system?.members ?? []).map((m) =>
    m.actorUuid === actorUuid ? { ...m, role } : m
  );
  await keep.update({ "system.members": members });
  return keep;
}

/**
 * List a Keep's members.
 * @param {Actor|string} keepOrId
 * @returns {{actorUuid: string, role: string, joinedAt: ?number}[]}
 */
export function listMembers(keepOrId) {
  return [...(resolveKeep(keepOrId).system?.members ?? [])];
}

/**
 * Resolve one of a member's live benefit modifiers (e.g. a merchant price
 * multiplier). Delegates to the benefit engine; only *applied* benefits count.
 * @param {Actor|string} keepOrId
 * @param {string} actorUuid
 * @param {string} key
 * @returns {number}
 */
export function getMemberModifier(keepOrId, actorUuid, key) {
  const keep = resolveKeep(keepOrId);
  const member = findMember(keep, actorUuid);
  if (!member) return 0;
  return resolveMemberModifier(keep, member, key);
}

/**
 * Withdraw resources from a Keep's stockpile on a member's behalf — enforced by
 * the `stockpile.withdraw` capability benefit (the one capability the engine owns
 * the resource for). Throws if the member lacks the capability.
 * @param {Actor|string} keepOrId
 * @param {string} actorUuid
 * @param {string} resource
 * @param {number} qty  positive amount to withdraw
 * @returns {Promise<Actor>}
 */
export async function memberWithdraw(keepOrId, actorUuid, resource, qty) {
  const keep = resolveKeep(keepOrId);
  const member = findMember(keep, actorUuid);
  if (!member) throw new Error(`[automate-fvtt] not a member of this Keep: ${actorUuid}`);
  const caps = getMemberCapabilities(keep, member);
  if (!caps["stockpile.withdraw"]) {
    throw new Error(`[automate-fvtt] member ${actorUuid} lacks stockpile.withdraw on ${keep.id}`);
  }
  return adjustResource(keep, resource, -Math.abs(Number(qty) || 0));
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
  collectPorts,
  // Membership + benefits (Change A).
  members: {
    add: addMember,
    remove: removeMember,
    setRole: setMemberRole,
    list: listMembers,
  },
  getMemberModifier,
  memberWithdraw,
};

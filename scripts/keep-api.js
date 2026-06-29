/**
 * CRUD surface for Keep actors. Published at
 * `game.modules.get("automate-fvtt").api.keeps`.
 *
 * A Keep is a **core-type actor** (pf2e `loot`, dnd5e `npc`, …) carrying its
 * ledger under the `flags["automate-fvtt"].keep` object — NOT a custom Actor
 * sub-type, because pf2e (the primary target) forbids module Actor sub-types.
 * See `constants.KEEP_FLAG`. The {@link KeepModel} schema validates/cleans that
 * flag payload via {@link cleanKeepData}.
 *
 * All mutators go through the Actor document so persistence, permissions, and
 * undo come for free; the `automate-fvtt.keepUpdated` hook is emitted centrally
 * from an `updateActor` listener (see {@link registerKeepHooks}) so both API and
 * sheet edits notify listeners.
 * @module keep-api
 */

import {
  MODULE_ID,
  KEEP_ICON,
  KEEP_FLAG,
  KEEP_DATA_PATH,
  KEEP_ACTOR_TYPE_BY_SYSTEM,
  HOOKS,
} from "./constants.js";
import { KeepModel } from "./data/keep-model.js";
import { log } from "./logger.js";
import { getMemberModifier as resolveMemberModifier, getMemberCapabilities } from "./benefits/benefit-engine.js";

/**
 * Is this actor one of our Keeps? Identified by the presence of the module's
 * `keep` flag, so it works regardless of the core actor type backing it.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isKeepActor(actor) {
  return !!(actor?.getFlag?.(MODULE_ID, KEEP_FLAG) ?? actor?.flags?.[MODULE_ID]?.[KEEP_FLAG]);
}

/**
 * Read a Keep's ledger flag (stockpile/counts/buffers/ruleIds/sceneId). Returns
 * an empty object for a non-Keep actor.
 * @param {Actor} actor
 * @returns {object}
 */
export function getKeepData(actor) {
  return actor?.getFlag?.(MODULE_ID, KEEP_FLAG) ?? actor?.flags?.[MODULE_ID]?.[KEEP_FLAG] ?? {};
}

/**
 * Validate and fill a partial Keep payload against the {@link KeepModel} schema,
 * returning a clean plain object (defaults applied, values coerced/clamped).
 * @param {object} [data]
 * @returns {object}
 */
export function cleanKeepData(data = {}) {
  return new KeepModel(data).toObject();
}

/**
 * Choose the core Actor type to back a new Keep in the active game system,
 * preferring {@link KEEP_ACTOR_TYPE_BY_SYSTEM} and falling back to a generic
 * type the system actually defines.
 * @returns {string}
 */
export function pickKeepActorType() {
  const types = (game.documentTypes?.Actor ?? []).filter((t) => t !== "base" && !t.includes("."));
  const preferred = KEEP_ACTOR_TYPE_BY_SYSTEM[game.system?.id];
  if (preferred && types.includes(preferred)) return preferred;
  return ["loot", "npc", "character", "vehicle"].find((t) => types.includes(t)) ?? types[0] ?? "base";
}

/** @returns {Actor[]} all Keep actors in the world. */
export function listKeeps() {
  return game.actors?.filter(isKeepActor) ?? [];
}

/**
 * @param {string} id  Actor id.
 * @returns {Actor|null} the Keep with this id, or null if missing/not a Keep.
 */
export function getKeep(id) {
  const actor = game.actors?.get(id) ?? null;
  return isKeepActor(actor) ? actor : null;
}

/**
 * @param {string} sceneId
 * @returns {Actor|null} the Keep that owns the given scene, if any.
 */
export function getSceneKeep(sceneId) {
  return listKeeps().find((k) => getKeepData(k).sceneId === sceneId) ?? null;
}

/**
 * Create a new Keep actor backed by a core type + the module flag.
 * @param {object} [data]
 * @param {string} [data.name="New Keep"]
 * @param {?string} [data.sceneId=null]
 * @param {object} [data.stockpile]  resource → qty
 * @param {object} [data.counts]     { henchmen, garden }
 * @returns {Promise<Actor>}
 */
export async function createKeep({ name = "New Keep", sceneId = null, stockpile = {}, counts = {}, img = KEEP_ICON } = {}) {
  const type = pickKeepActorType();
  const keep = cleanKeepData({ sceneId, stockpile, counts });
  const actor = await Actor.create({
    name,
    type,
    img,
    flags: { [MODULE_ID]: { [KEEP_FLAG]: keep } },
  });
  log.debug(`Created Keep "${name}" (${actor?.id}) as a "${type}" actor.`);
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
  await keep.update({ [`${KEEP_DATA_PATH}.stockpile.${resource}`]: Math.max(0, Number(qty) || 0) });
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
  const current = Number(getKeepData(keep).stockpile?.[resource] ?? 0);
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
  await keep.update({ [`${KEEP_DATA_PATH}.stockpile.-=${resource}`]: null });
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
  await keep.update({ [`${KEEP_DATA_PATH}.counts.${key}`]: Math.max(0, Math.floor(Number(value) || 0)) });
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
  const data = getKeepData(keep);
  const buffers = data.buffers ?? {};
  const stockpile = data.stockpile ?? {};
  const keys = bufferKey ? [bufferKey] : Object.keys(buffers);
  const update = {};

  for (const key of keys) {
    const held = buffers[key];
    if (!held) continue;
    for (const [res, qty] of Object.entries(held)) {
      const amount = Number(qty) || 0;
      if (amount <= 0) continue;
      const path = `${KEEP_DATA_PATH}.stockpile.${res}`;
      const base = update[path] ?? Number(stockpile[res] ?? 0);
      update[path] = base + amount;
    }
    update[`${KEEP_DATA_PATH}.buffers.-=${key}`] = null; // clear the drained buffer
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
  return (getKeepData(keep).members ?? []).find((m) => m.actorUuid === actorUuid);
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
  const members = [...(getKeepData(keep).members ?? []), { actorUuid, role, joinedAt: game.time?.worldTime ?? null }];
  await keep.update({ [`${KEEP_DATA_PATH}.members`]: members });
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
  const members = (getKeepData(keep).members ?? []).filter((m) => m.actorUuid !== actorUuid);
  await keep.update({ [`${KEEP_DATA_PATH}.members`]: members });
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
  const members = (getKeepData(keep).members ?? []).map((m) =>
    m.actorUuid === actorUuid ? { ...m, role } : m
  );
  await keep.update({ [`${KEEP_DATA_PATH}.members`]: members });
  return keep;
}

/**
 * List a Keep's members.
 * @param {Actor|string} keepOrId
 * @returns {{actorUuid: string, role: string, joinedAt: ?number}[]}
 */
export function listMembers(keepOrId) {
  return [...(getKeepData(resolveKeep(keepOrId)).members ?? [])];
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
  if (!isKeepActor(keep)) {
    throw new Error(`[automate-fvtt] Not a Keep actor: ${keepOrId?.id ?? keepOrId}`);
  }
  return keep;
}

/**
 * Wire the central `keepUpdated` emitter. Call once during init/ready.
 */
export function registerKeepHooks() {
  Hooks.on("updateActor", (actor, changed) => {
    if (!isKeepActor(actor)) return;
    // Re-emit when our ledger flag (or the actor name) changed.
    if (
      foundry.utils.hasProperty(changed, KEEP_DATA_PATH) ||
      foundry.utils.hasProperty(changed, "name")
    ) {
      Hooks.callAll(HOOKS.KEEP_UPDATED, actor);
    }
  });
}

/** The public keeps API object (the `open` member is composed in by the bootstrap). */
export const keepsApi = {
  create: createKeep,
  list: listKeeps,
  get: getKeep,
  getForScene: getSceneKeep,
  isKeep: isKeepActor,
  getData: getKeepData,
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

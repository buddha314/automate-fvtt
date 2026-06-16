/**
 * Foundry wiring for the membership-benefits core — the event-driven sibling of
 * the tick rules engine (Change A). Pure logic lives in
 * {@link module:benefits/benefits} and {@link module:benefits/benefit-store};
 * this module reads Keeps/members from Foundry, applies/revokes the four
 * expression primitives, and re-resolves on the relevant events.
 *
 * **Re-resolution is event-driven, not tick-driven** (Decision 2): membership
 * change, token scene change (the `while-present` condition), and tier change.
 * Benefits never participate in the economy tick, so they never block a clock
 * fast-forward — they simply re-resolve once at the landing point (the
 * `updateWorldTime` listener below).
 *
 * @module benefits/benefit-engine
 */

import { KEEP_TYPE, HOOKS, MODULE_ID } from "../constants.js";
import { log } from "../logger.js";
import {
  PRIMITIVE,
  MODE,
  computeResolution,
  appliedBenefits,
  resolveModifiers,
  resolveCapabilities,
} from "./benefits.js";
import { definitionsForKeep } from "./benefit-store.js";

/** Flag scope on a member actor recording engine-applied benefit state per Keep. */
const FLAG_APPLIED = "benefitsApplied"; // flags.<MODULE_ID>.benefitsApplied[keepId] = { effectIds, approved }

/**
 * Resolve a member's live benefits for a Keep, given the member's current
 * context (role from the roster, the Keep's tier, and token presence).
 * @param {Actor} keep
 * @param {{actorUuid: string, role: string}} member
 * @returns {{ benefits: import("./benefits.js").LiveBenefit[], ctx: object, actor: Actor|null }}
 */
export function resolveMember(keep, member) {
  const actor = fromUuidSafe(member.actorUuid);
  const ctx = {
    role: member.role,
    tier: Number(keep.system?.tier ?? 0),
    present: actor ? isPresentOnScene(actor, keep.system?.sceneId) : false,
  };
  const defs = definitionsForKeep(keep.id);
  return { ...computeResolution(ctx, defs), ctx, actor };
}

/**
 * Look up a member's resolved `modifier` values for a Keep — the public query
 * adapters and content use to honor benefits (e.g. a merchant price multiplier).
 * Only *applied* benefits count: every `auto` benefit plus GM-approved
 * `interactive` ones.
 * @param {Actor} keep
 * @param {{actorUuid: string, role: string}} member
 * @returns {Object<string, number>} key → resolved value
 */
export function getMemberModifiers(keep, member) {
  const { benefits, actor } = resolveMember(keep, member);
  return resolveModifiers(appliedBenefits(benefits, approvedSet(actor, keep.id)));
}

/**
 * One modifier value for a member (convenience over {@link getMemberModifiers}).
 * @returns {number} 0 if the key has no live contribution
 */
export function getMemberModifier(keep, member, key) {
  return getMemberModifiers(keep, member)[key] ?? 0;
}

/**
 * A member's resolved capabilities for a Keep (key → quota|true).
 * @returns {Object<string, (number|boolean)>}
 */
export function getMemberCapabilities(keep, member) {
  const { benefits, actor } = resolveMember(keep, member);
  return resolveCapabilities(appliedBenefits(benefits, approvedSet(actor, keep.id)));
}

/**
 * Re-resolve and apply every member's benefits for a Keep. Idempotent: diffs the
 * desired `effect` set against what was applied (recorded in a member flag) and
 * only creates/deletes the difference, so it is safe to call on every event.
 * Auto benefits apply immediately; interactive benefits fire {@link HOOKS.BENEFIT_PENDING}
 * for the GM prompt unless already approved.
 * @param {Actor} keep
 * @returns {Promise<void>}
 */
export async function resolveKeep(keep) {
  if (!keep || keep.type !== KEEP_TYPE) return;
  if (!isAuthoritativeGM()) return; // single writer in a multi-client world
  for (const member of keep.system?.members ?? []) {
    try {
      await resolveAndApplyMember(keep, member);
    } catch (err) {
      log.error(`benefit resolve failed for ${member.actorUuid} @ ${keep.id}:`, err);
    }
  }
}

/**
 * Resolve one member and reconcile applied Active Effects with the live set.
 * @param {Actor} keep
 * @param {{actorUuid: string, role: string}} member
 */
async function resolveAndApplyMember(keep, member) {
  const { benefits, actor } = resolveMember(keep, member);
  if (!actor) return;

  const approved = approvedSet(actor, keep.id);
  const applicable = appliedBenefits(benefits, approved);

  // Surface interactive benefits that are live but not yet approved.
  for (const b of benefits) {
    if (b.mode !== "auto" && !approved.has(b.id)) {
      Hooks.callAll(HOOKS.BENEFIT_PENDING, { keep, member, benefit: b });
    }
  }

  // EFFECT primitive: reconcile our managed AEs against the applied effect set.
  const desiredEffects = new Map(
    applicable.filter((b) => b.primitive === PRIMITIVE.EFFECT).map((b) => [b.id, b.payload?.effect])
  );
  const prior = actor.getFlag(MODULE_ID, FLAG_APPLIED)?.[keep.id]?.effectIds ?? {};

  // Revoke effects no longer live.
  const toDelete = Object.entries(prior)
    .filter(([benefitId]) => !desiredEffects.has(benefitId))
    .map(([, effectId]) => effectId)
    .filter((id) => actor.effects.get(id));
  if (toDelete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);

  // Grant effects newly live.
  const newEffectIds = { ...prior };
  for (const id of toDelete.map((e) => e)) void id;
  for (const [benefitId, effectData] of desiredEffects) {
    if (prior[benefitId] && actor.effects.get(prior[benefitId])) continue; // already applied
    if (!effectData) continue;
    const created = await actor.createEmbeddedDocuments("ActiveEffect", [
      { ...effectData, flags: { ...(effectData.flags ?? {}), [MODULE_ID]: { benefitId, keepId: keep.id } } },
    ]);
    if (created?.[0]) newEffectIds[benefitId] = created[0].id;
  }
  // Drop revoked ids from the record.
  for (const benefitId of Object.keys(newEffectIds)) {
    if (!desiredEffects.has(benefitId)) delete newEffectIds[benefitId];
  }

  await setAppliedRecord(actor, keep.id, { effectIds: newEffectIds });
}

/**
 * Approve a live `interactive` benefit for a member (the GM clicked "apply"),
 * then re-resolve so its expression is applied.
 * @param {Actor} keep
 * @param {string} actorUuid
 * @param {string} benefitId
 */
export async function approveBenefit(keep, actorUuid, benefitId) {
  const actor = fromUuidSafe(actorUuid);
  if (!actor) return;
  const approved = new Set(approvedSet(actor, keep.id));
  approved.add(benefitId);
  await setAppliedRecord(actor, keep.id, { approved: [...approved] });
  await resolveKeep(keep);
}

/**
 * Invoke an `action` benefit for a member: the engine emits
 * {@link HOOKS.BENEFIT_INVOKED} and performs no system-specific effect itself.
 * @param {Actor} keep
 * @param {string} actorUuid
 * @param {string} benefitId
 * @returns {boolean} whether the action was live and emitted
 */
export function invokeAction(keep, actorUuid, benefitId) {
  const member = (keep.system?.members ?? []).find((m) => m.actorUuid === actorUuid);
  if (!member) return false;
  const { benefits } = resolveMember(keep, member);
  const benefit = benefits.find((b) => b.id === benefitId && b.primitive === PRIMITIVE.ACTION);
  if (!benefit) return false;
  Hooks.callAll(HOOKS.BENEFIT_INVOKED, { keep, member, benefit, actionId: benefit.payload?.actionId ?? benefitId });
  return true;
}

/**
 * A display view of a member's live benefits for the Keep sheet: each live
 * benefit tagged with its applied/pending status and whether it is an invokable
 * action. Read-only — does not apply anything.
 * @param {Actor} keep
 * @param {{actorUuid: string, role: string}} member
 * @returns {{id: string, name: string, primitive: string, mode: string, status: string, isAction: boolean}[]}
 */
export function memberBenefitView(keep, member) {
  const { benefits, actor } = resolveMember(keep, member);
  const approved = approvedSet(actor, keep.id);
  return benefits.map((b) => {
    const applied = b.mode === MODE.AUTO || approved.has(b.id);
    return {
      id: b.id,
      name: b.name ?? b.id,
      primitive: b.primitive,
      mode: b.mode,
      status: applied ? "applied" : "pending",
      isPending: !applied,
      isAction: b.primitive === PRIMITIVE.ACTION,
    };
  });
}

/** In-session dedup so a pending benefit prompts the GM at most once per resolve cycle. */
const prompted = new Set();

/**
 * Wire the interactive-benefit GM prompt (task 7.3): on {@link HOOKS.BENEFIT_PENDING}
 * whisper the authoritative GM a chat card with an "Apply" button that approves
 * the benefit. Deduped in-session so re-resolves don't spam. Call once at init.
 */
export function registerBenefitPrompt() {
  Hooks.on(HOOKS.BENEFIT_PENDING, ({ keep, member, benefit }) => {
    if (!isAuthoritativeGM()) return;
    const key = `${keep.id}:${member.actorUuid}:${benefit.id}`;
    if (prompted.has(key)) return;
    prompted.add(key);
    const who = fromUuidSafe(member.actorUuid)?.name ?? member.actorUuid;
    void ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
      content:
        `<div class="afvtt-benefit-prompt"><p><strong>${keep.name}</strong>: apply ` +
        `<em>${benefit.name ?? benefit.id}</em> to ${who}?</p>` +
        `<button type="button" data-action="afvtt-approve-benefit" data-keep="${keep.id}" ` +
        `data-actor="${member.actorUuid}" data-benefit="${benefit.id}">Apply</button></div>`,
    });
  });

  // Click delegate for the chat-card "Apply" button (v13 render hook).
  Hooks.on("renderChatMessageHTML", (_msg, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    root?.querySelectorAll?.('[data-action="afvtt-approve-benefit"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const keep = game.actors?.get(btn.dataset.keep);
        if (!keep) return;
        await approveBenefit(keep, btn.dataset.actor, btn.dataset.benefit);
        prompted.delete(`${btn.dataset.keep}:${btn.dataset.actor}:${btn.dataset.benefit}`);
        btn.disabled = true;
      });
    });
  });
}

/**
 * Wire the event-driven re-resolution. Call once during init/ready.
 * Re-resolves on membership change, tier change, token scene movement, and the
 * world-time landing point (so `while-present` and post-fast-forward state settle).
 */
export function registerBenefitEngine() {
  // Membership / tier changes on the Keep actor.
  Hooks.on("updateActor", (actor, changed) => {
    if (actor.type !== KEEP_TYPE) return;
    if (foundry.utils.hasProperty(changed, "system.members") || foundry.utils.hasProperty(changed, "system.tier")) {
      if (foundry.utils.hasProperty(changed, "system.members")) Hooks.callAll(HOOKS.MEMBERSHIP_CHANGED, actor);
      void resolveKeep(actor);
    }
  });

  // Token scene movement → the `while-present` condition. Re-resolve the Keep
  // that owns the token's scene (cheap; the resolver is idempotent).
  const onTokenScene = (tokenDoc) => {
    const sceneId = tokenDoc?.parent?.id ?? tokenDoc?.scene?.id;
    if (!sceneId) return;
    for (const keep of game.actors?.filter((a) => a.type === KEEP_TYPE && a.system?.sceneId === sceneId) ?? []) {
      void resolveKeep(keep);
    }
  };
  Hooks.on("createToken", onTokenScene);
  Hooks.on("deleteToken", onTokenScene);

  // World-time landing point: benefits never block a fast-forward; they re-resolve
  // once here against the post-jump state.
  Hooks.on("updateWorldTime", () => {
    for (const keep of game.actors?.filter((a) => a.type === KEEP_TYPE) ?? []) void resolveKeep(keep);
  });
}

/* ----------------------------- helpers ----------------------------- */

/** @param {Actor} actor @param {string} keepId @returns {Set<string>} approved interactive ids */
function approvedSet(actor, keepId) {
  return new Set(actor?.getFlag?.(MODULE_ID, FLAG_APPLIED)?.[keepId]?.approved ?? []);
}

/** Merge a partial applied-record for (actor, keep) without clobbering siblings. */
async function setAppliedRecord(actor, keepId, patch) {
  const all = foundry.utils.deepClone(actor.getFlag(MODULE_ID, FLAG_APPLIED) ?? {});
  all[keepId] = { ...(all[keepId] ?? {}), ...patch };
  await actor.setFlag(MODULE_ID, FLAG_APPLIED, all);
}

/** Resolve a UUID synchronously where possible; null on miss. @returns {Actor|null} */
function fromUuidSafe(uuid) {
  try {
    const doc = fromUuidSync?.(uuid) ?? null;
    return doc && doc.documentName === "Actor" ? doc : doc?.actor ?? null;
  } catch {
    return null;
  }
}

/** Does any of the actor's tokens stand on the given scene? @returns {boolean} */
function isPresentOnScene(actor, sceneId) {
  if (!sceneId) return false;
  const scene = game.scenes?.get(sceneId);
  if (!scene) return false;
  return scene.tokens?.some((t) => t.actorId === actor.id) ?? false;
}

/**
 * Is this client the authoritative GM writer? Mirrors the guard the rules engine
 * uses so benefit application happens on exactly one client.
 * @returns {boolean}
 */
function isAuthoritativeGM() {
  const users = game.users;
  if (users?.activeGM) return users.activeGM === game.user;
  return !!game.user?.isGM;
}

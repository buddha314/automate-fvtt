/**
 * Foundry wiring for Keep evolution — metric sources, event-driven tier recompute,
 * and publishing the tier's storage capacities to the Keep flag (which the output
 * pipeline reads). Pure logic (tier table + derivations) lives in
 * {@link module:evolution/evolution}.
 *
 * Tier is recomputed on the authoritative GM whenever a metric changes (membership,
 * area, …), stored on the Keep `tier` flag, and a {@link HOOKS.TIER_CHANGED} hook
 * fires when it moves. Event-driven — it never participates in the economy tick.
 *
 * @module evolution/evolution-engine
 */

import { MODULE_ID, KEEP_DATA_PATH, HOOKS } from "../constants.js";
import { log } from "../logger.js";
import { getKeep, getKeepData, isKeepActor } from "../keep-api.js";
import { DEFAULT_TIER_TABLE, computeTier, capacitiesForTier } from "./evolution.js";

const METRICS_PATH = `${KEEP_DATA_PATH}.metrics`;
const MEMBERS_PATH = `${KEEP_DATA_PATH}.members`;

/** @type {{tier: number, name: string, min: Object<string, number>}[]} */
let tierTable = DEFAULT_TIER_TABLE;
/** @type {Object<string, number>} per-resource base capacity (scaled by tier). */
let capacityBase = {};

/**
 * Configure the evolution model: the tier `table` and/or the `capacityBase`
 * (per-resource caps that scale with tier). Either replaces the prior value.
 * @param {object} cfg
 * @param {{tier: number, min: Object<string, number>}[]} [cfg.tierTable]
 * @param {Object<string, number>} [cfg.capacityBase]
 */
export function configureEvolution({ tierTable: table, capacityBase: base } = {}) {
  if (table) tierTable = table;
  if (base) capacityBase = { ...base };
}

/** @param {Actor|string} keepOrId @returns {Actor} @throws if not a Keep. */
function resolveKeep(keepOrId) {
  const keep = typeof keepOrId === "string" ? getKeep(keepOrId) : keepOrId;
  if (!isKeepActor(keep)) throw new Error(`[automate-fvtt] Not a Keep actor: ${keepOrId?.id ?? keepOrId}`);
  return keep;
}

function isAuthoritativeGM() {
  const users = game.users;
  if (users?.activeGM) return users.activeGM === game.user;
  if (!game.user?.isGM) return false;
  const firstGM = users?.filter((u) => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id))[0];
  return firstGM === game.user;
}

/**
 * The metric map used for tier computation: GM/content metrics plus derived ones
 * (membership = roster count).
 * @param {object} keepData
 * @returns {Object<string, number>}
 */
export function metricsOf(keepData) {
  return { ...(keepData?.metrics ?? {}), membership: (keepData?.members ?? []).length };
}

/** @param {Actor|string} keepOrId @returns {number} the Keep's current tier. */
export function getTier(keepOrId) {
  return Number(getKeepData(resolveKeep(keepOrId)).tier ?? 0) || 0;
}

/**
 * Recompute a Keep's tier from its metrics. On a change, writes the `tier` flag + the
 * tier's storage `capacities`, and fires {@link HOOKS.TIER_CHANGED}.
 * @param {Actor|string} keepOrId
 * @returns {Promise<{tier: number, previous: number, changed: boolean}>}
 */
export async function recomputeTier(keepOrId) {
  const keep = resolveKeep(keepOrId);
  const data = getKeepData(keep);
  const previous = Number(data.tier ?? 0) || 0;
  const tier = computeTier(metricsOf(data), tierTable);
  if (tier === previous) return { tier, previous, changed: false };

  await keep.update({
    [`${KEEP_DATA_PATH}.tier`]: tier,
    [`${KEEP_DATA_PATH}.capacities`]: capacitiesForTier(tier, capacityBase),
  });
  Hooks.callAll(HOOKS.TIER_CHANGED, { keep, tier, previous });
  log.debug(`evolution: ${keep.name} tier ${previous} → ${tier}.`);
  return { tier, previous, changed: true };
}

/**
 * Set a GM/content metric on a Keep and recompute its tier.
 * @param {Actor|string} keepOrId
 * @param {string} key  metric key (e.g. "population", "area", "order")
 * @param {number} value
 * @returns {Promise<{tier: number, previous: number, changed: boolean}>}
 */
export async function setMetric(keepOrId, key, value) {
  const keep = resolveKeep(keepOrId);
  await keep.update({ [`${METRICS_PATH}.${key}`]: Number(value) || 0 });
  return recomputeTier(keep);
}

/**
 * Wire event-driven tier recompute: recompute when a Keep's metrics or membership
 * change. Authoritative GM only. Call once during init/ready.
 */
export function registerEvolutionEngine() {
  Hooks.on("updateActor", (actor, changed) => {
    if (!isKeepActor(actor) || !isAuthoritativeGM()) return;
    if (foundry.utils.hasProperty(changed, METRICS_PATH) || foundry.utils.hasProperty(changed, MEMBERS_PATH)) {
      void recomputeTier(actor).catch((err) => log.error(`evolution recompute for "${actor?.name}":`, err));
    }
  });
  log.debug("evolution engine registered");
}

/** Public evolution API surface (composed into `api.evolution`). */
export const evolutionApi = {
  configure: configureEvolution,
  getTier,
  setMetric,
  recompute: recomputeTier,
  metricsOf,
};

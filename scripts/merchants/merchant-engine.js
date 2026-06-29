/**
 * Foundry wiring for merchants — Keep-flag CRUD + tick-cadence restocking.
 * Pure logic (the model + weighted draw) lives in {@link module:merchants/merchants}.
 *
 * Merchants are stored under the Keep flag (`flags["automate-fvtt"].keep.merchants`),
 * the same store as membership. Restocking runs on the world-time tick, on the single
 * authoritative GM, and is broadcast via the actor update (so every client sees the
 * same stock without recomputing — no seeded RNG needed).
 *
 * NOT YET wired here: the buy side (surplus → currency) and sell side (player
 * purchases) — those need the currency plumbing from the output-economy design (#46)
 * and a decision on where the Keep treasury is held. See the design choke point.
 *
 * @module merchants/merchant-engine
 */

import { MODULE_ID, KEEP_DATA_PATH } from "../constants.js";
import { log } from "../logger.js";
import { getKeep, getKeepData, isKeepActor, listKeeps } from "../keep-api.js";
import { onTick } from "../time/tick-dispatcher.js";
import { makeMerchant, restockStock, isRestockDue } from "./merchants.js";

const MERCHANTS_PATH = `${KEEP_DATA_PATH}.merchants`;

/** @param {Actor|string} keepOrId @returns {Actor} @throws if not a Keep. */
function resolveKeep(keepOrId) {
  const keep = typeof keepOrId === "string" ? getKeep(keepOrId) : keepOrId;
  if (!isKeepActor(keep)) throw new Error(`[automate-fvtt] Not a Keep actor: ${keepOrId?.id ?? keepOrId}`);
  return keep;
}

/** Single authoritative writer guard (mirrors the rules engine). @returns {boolean} */
function isAuthoritativeGM() {
  const users = game.users;
  if (users?.activeGM) return users.activeGM === game.user;
  if (!game.user?.isGM) return false;
  const firstGM = users?.filter((u) => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id))[0];
  return firstGM === game.user;
}

/**
 * @param {Actor|string} keepOrId
 * @returns {import("./merchants.js").Merchant[]} the Keep's merchants
 */
export function listMerchants(keepOrId) {
  return [...(getKeepData(resolveKeep(keepOrId)).merchants ?? [])];
}

/**
 * @param {Actor|string} keepOrId
 * @param {string} merchantId
 * @returns {import("./merchants.js").Merchant|undefined}
 */
export function getMerchant(keepOrId, merchantId) {
  return (getKeepData(resolveKeep(keepOrId)).merchants ?? []).find((m) => m.id === merchantId);
}

/**
 * Attach a merchant to a Keep. Fills defaults via {@link makeMerchant}; generates an
 * id when none is given.
 * @param {Actor|string} keepOrId
 * @param {Partial<import("./merchants.js").Merchant>} [data]
 * @returns {Promise<import("./merchants.js").Merchant>}
 */
export async function addMerchant(keepOrId, data = {}) {
  const keep = resolveKeep(keepOrId);
  const merchant = makeMerchant({ id: data.id ?? foundry.utils.randomID(), ...data });
  const merchants = [...(getKeepData(keep).merchants ?? []), merchant];
  await keep.update({ [MERCHANTS_PATH]: merchants });
  log.debug(`added ${merchant.type} merchant "${merchant.name}" (${merchant.id}) to ${keep.name}.`);
  return merchant;
}

/**
 * Remove a merchant from a Keep.
 * @param {Actor|string} keepOrId
 * @param {string} merchantId
 * @returns {Promise<Actor>}
 */
export async function removeMerchant(keepOrId, merchantId) {
  const keep = resolveKeep(keepOrId);
  const merchants = (getKeepData(keep).merchants ?? []).filter((m) => m.id !== merchantId);
  await keep.update({ [MERCHANTS_PATH]: merchants });
  return keep;
}

/**
 * Restock one merchant now: regenerate its stock from its restock rule and stamp
 * `lastRestockAt`. Writes the whole merchants array (single-writer broadcast).
 * @param {Actor|string} keepOrId
 * @param {string} merchantId
 * @param {object} [opts]
 * @param {number} [opts.worldTime] world-time to stamp (defaults to current)
 * @returns {Promise<import("./merchants.js").Merchant|null>}
 */
export async function restockMerchant(keepOrId, merchantId, { worldTime } = {}) {
  const keep = resolveKeep(keepOrId);
  const now = Number(worldTime ?? game.time?.worldTime ?? 0);
  const merchants = getKeepData(keep).merchants ?? [];
  let restocked = null;
  const next = merchants.map((m) => {
    if (m.id !== merchantId) return m;
    restocked = { ...m, stock: restockStock(m.restock, m.capacity), restock: { ...m.restock, lastRestockAt: now } };
    return restocked;
  });
  if (restocked) await keep.update({ [MERCHANTS_PATH]: next });
  return restocked;
}

/**
 * Restock every merchant on a Keep whose cadence has elapsed. One write per Keep.
 * @param {Actor} keep
 * @param {number} worldTime
 * @returns {Promise<boolean>} whether anything was restocked
 */
export async function restockDueMerchants(keep, worldTime) {
  const merchants = getKeepData(keep).merchants ?? [];
  if (!merchants.length) return false;
  let changed = false;
  const next = merchants.map((m) => {
    if (!isRestockDue(m, worldTime)) return m;
    changed = true;
    return { ...m, stock: restockStock(m.restock, m.capacity), restock: { ...m.restock, lastRestockAt: worldTime } };
  });
  if (changed) await keep.update({ [MERCHANTS_PATH]: next });
  return changed;
}

/**
 * Wire merchant restocking to the world-time tick. Authoritative GM only. Call once
 * during init/ready (after the tick dispatcher is registered).
 */
export function registerMerchantEngine() {
  onTick("merchant-engine", ({ worldTime }) => {
    if (!isAuthoritativeGM()) return;
    void (async () => {
      for (const keep of listKeeps()) {
        try {
          await restockDueMerchants(keep, worldTime);
        } catch (err) {
          log.error(`merchant restock failed for "${keep?.name}":`, err);
        }
      }
    })();
  });
  log.debug("merchant engine registered");
}

/** Public merchant API surface (composed into `api.merchants`). */
export const merchantsApi = {
  list: listMerchants,
  get: getMerchant,
  add: addMerchant,
  remove: removeMerchant,
  restock: restockMerchant,
};

/**
 * Pure merchant logic — the data model + the weighted-random restock algorithm
 * from `MERCHANT.md`. No Foundry/Fabricate imports, fully unit-testable. The
 * Foundry wiring (Keep-flag CRUD, tick cadence, buy/sell) lives in
 * {@link module:merchants/merchant-engine}.
 *
 * @module merchants/merchants
 */

/** One week, in seconds — the default restock cadence (`MERCHANT.md`). */
export const DEFAULT_RESTOCK_SECONDS = 604800;

/**
 * @typedef {Object} MerchantRestock
 * @property {number} intervalSeconds  restock cadence (a function of the Keep)
 * @property {{itemUuid: string, baseValue: number, weight?: number}[]} candidates  the draw pool
 * @property {"inverseValue"|"uniform"|"explicit"} weighting  how candidates are weighted
 * @property {number} rarityBias  0 = pure inverse-value (cheap common); 1 = favor high value
 * @property {?number} lastRestockAt  world-time of the last restock
 *
 * @typedef {Object} Merchant
 * @property {string} id
 * @property {string} type  content-defined ("smith"|"alchemist"|"tinkerer"|"trader"|…)
 * @property {string} name
 * @property {number} capacity  max stock slots
 * @property {{itemUuid: string, quantity: number, price: number}[]} stock
 * @property {MerchantRestock} restock
 * @property {{resourceKey: string, price: number}[]} buys  surplus the merchant purchases
 */

/**
 * Build a normalized merchant record (defaults filled). `id` is required (the
 * Foundry layer supplies one); everything else defaults.
 * @param {Partial<Merchant> & {id: string}} data
 * @returns {Merchant}
 */
export function makeMerchant(data = {}) {
  if (!data.id) throw new Error("[automate-fvtt] makeMerchant requires an id");
  const restock = data.restock ?? {};
  return {
    id: data.id,
    type: data.type ?? "trader",
    name: data.name ?? "Merchant",
    capacity: Math.max(0, Math.floor(Number(data.capacity ?? 5) || 0)),
    stock: Array.isArray(data.stock) ? data.stock : [],
    restock: {
      intervalSeconds: Math.max(1, Number(restock.intervalSeconds ?? DEFAULT_RESTOCK_SECONDS) || DEFAULT_RESTOCK_SECONDS),
      candidates: Array.isArray(restock.candidates) ? restock.candidates : [],
      weighting: ["inverseValue", "uniform", "explicit"].includes(restock.weighting) ? restock.weighting : "inverseValue",
      rarityBias: Math.min(1, Math.max(0, Number(restock.rarityBias ?? 0) || 0)),
      lastRestockAt: restock.lastRestockAt ?? null,
    },
    buys: Array.isArray(data.buys) ? data.buys : [],
  };
}

/**
 * Compute the per-candidate draw weights for a restock config. Pure.
 *
 * `inverseValue` (default, the `MERCHANT.md` multinomial) blends an inverse-value
 * share (cheap items common) with a value share (expensive items common) by
 * `rarityBias`: 0 → pure inverse-value, 1 → pure value-weighted.
 * @param {{itemUuid: string, baseValue: number, weight?: number}[]} candidates
 * @param {"inverseValue"|"uniform"|"explicit"} weighting
 * @param {number} rarityBias
 * @returns {number[]} non-negative weights aligned to `candidates`
 */
export function candidateWeights(candidates, weighting = "inverseValue", rarityBias = 0) {
  const list = candidates ?? [];
  if (!list.length) return [];
  if (weighting === "uniform") return list.map(() => 1);
  if (weighting === "explicit") return list.map((c) => Math.max(0, Number(c?.weight ?? 1) || 0));

  // inverseValue (default)
  const values = list.map((c) => Math.max(0, Number(c?.baseValue ?? 0) || 0));
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return list.map(() => 1); // no values → uniform
  const bias = Math.min(1, Math.max(0, rarityBias));
  const n = list.length;
  // inverse share sums to 1 across items: (1 - v/total) / (n - 1)
  const denomInv = n > 1 ? n - 1 : 1;
  return values.map((v) => {
    const valueShare = v / total;
    const inverseShare = (1 - valueShare) / denomInv;
    return (1 - bias) * inverseShare + bias * valueShare;
  });
}

/**
 * Pick an index from `weights` proportionally. Pure (rng injectable for tests).
 * @param {number[]} weights
 * @param {() => number} [rng=Math.random]
 * @returns {number} chosen index, or -1 if no positive weight
 */
export function pickWeighted(weights, rng = Math.random) {
  const total = (weights ?? []).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (total <= 0) return -1;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    if (r < w) return i;
    r -= w;
  }
  return weights.length - 1; // float fallback
}

/**
 * Regenerate a merchant's stock: draw `capacity` items **with replacement** from the
 * restock candidates, weighted per {@link candidateWeights}; identical draws stack
 * into one entry's quantity. Pure (rng injectable). Price = the candidate baseValue.
 * @param {MerchantRestock} restock
 * @param {number} capacity
 * @param {() => number} [rng=Math.random]
 * @returns {{itemUuid: string, quantity: number, price: number}[]}
 */
export function restockStock(restock, capacity, rng = Math.random) {
  const candidates = restock?.candidates ?? [];
  const cap = Math.max(0, Math.floor(Number(capacity) || 0));
  if (!candidates.length || cap <= 0) return [];
  const weights = candidateWeights(candidates, restock.weighting, restock.rarityBias);
  const counts = new Map();
  for (let i = 0; i < cap; i++) {
    const idx = pickWeighted(weights, rng);
    if (idx < 0) break;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, quantity]) => ({
      itemUuid: candidates[idx].itemUuid,
      quantity,
      price: Math.max(0, Number(candidates[idx].baseValue ?? 0) || 0),
    }));
}

/**
 * Apply a discount fraction to a price. `discount` is a fraction in [0,1]
 * (0 = full price, 0.1 = 10% off); out-of-range values are clamped. Pure.
 * @param {number} price
 * @param {number} [discount=0]
 * @returns {number}
 */
export function discountedPrice(price, discount = 0) {
  const p = Math.max(0, Number(price) || 0);
  const d = Math.min(1, Math.max(0, Number(discount) || 0));
  return p * (1 - d);
}

/**
 * Resolve a surplus sale: how much can actually be sold and the revenue. Pure.
 * @param {number} available  units on hand
 * @param {number} requested  units requested to sell
 * @param {number} price      per-unit price
 * @returns {{ sold: number, revenue: number }}
 */
export function surplusSale(available, requested, price) {
  const sold = Math.max(0, Math.min(Math.floor(Number(available) || 0), Math.floor(Number(requested) || 0)));
  return { sold, revenue: sold * Math.max(0, Number(price) || 0) };
}

/**
 * Is a merchant due to restock at the given world time? Pure.
 * @param {Merchant} merchant
 * @param {number} worldTime
 * @returns {boolean}
 */
export function isRestockDue(merchant, worldTime) {
  const last = merchant?.restock?.lastRestockAt;
  if (last == null) return true; // never stocked
  const interval = merchant?.restock?.intervalSeconds ?? DEFAULT_RESTOCK_SECONDS;
  return Number(worldTime) >= Number(last) + interval;
}

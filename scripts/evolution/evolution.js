/**
 * Pure Keep-evolution logic — tier computation from metrics + per-tier derivations.
 * No Foundry/Fabricate imports, fully unit-testable. The Foundry wiring (metric
 * sources, event-driven recompute, pushing caps) lives in
 * {@link module:evolution/evolution-engine}.
 *
 * @module evolution/evolution
 */

/**
 * Default tier brackets (from `KEEP.md`). Each row's `min` is the metric floor a Keep
 * must meet to reach that tier; a Keep is the highest tier whose every `min` it meets.
 * Overridable per world.
 * @type {{tier: number, name: string, min: Object<string, number>}[]}
 */
export const DEFAULT_TIER_TABLE = [
  { tier: 0, name: "hamlet", min: {} },
  { tier: 1, name: "village", min: { population: 100 } },
  { tier: 2, name: "town", min: { population: 1000, area: 20 } },
  { tier: 3, name: "city", min: { population: 10000, area: 100 } },
  { tier: 4, name: "metropolis", min: { population: 100000, area: 500 } },
];

/**
 * Compute a Keep's tier: the highest table row whose every `min` metric is met. Pure.
 * @param {Object<string, number>} metrics  metricKey → value
 * @param {{tier: number, min: Object<string, number>}[]} [table=DEFAULT_TIER_TABLE]
 * @returns {number} the resolved tier
 */
export function computeTier(metrics = {}, table = DEFAULT_TIER_TABLE) {
  const rows = [...(table ?? [])].sort((a, b) => a.tier - b.tier);
  let result = rows.length ? rows[0].tier : 0;
  for (const row of rows) {
    const meets = Object.entries(row.min ?? {}).every(
      ([k, min]) => Number(metrics?.[k] ?? 0) >= Number(min)
    );
    if (meets) result = row.tier;
    else break; // brackets are monotone — once one fails, higher rows fail too
  }
  return result;
}

/**
 * The display name for a tier from the table.
 * @param {number} tier
 * @param {{tier: number, name: string}[]} [table=DEFAULT_TIER_TABLE]
 * @returns {string}
 */
export function tierName(tier, table = DEFAULT_TIER_TABLE) {
  return (table ?? []).find((r) => r.tier === tier)?.name ?? String(tier);
}

/**
 * Derive per-resource storage capacities for a tier from a base-cap map: each base
 * capacity scales with tier as `base × (tier + 1)`. Pure. An empty base → no caps.
 * @param {number} tier
 * @param {Object<string, number>} [base={}]  resourceKey → base capacity (per tier step)
 * @returns {Object<string, number>} resourceKey → capacity at this tier
 */
export function capacitiesForTier(tier, base = {}) {
  const t = Math.max(0, Math.floor(Number(tier) || 0));
  const out = {};
  for (const [res, cap] of Object.entries(base ?? {})) {
    out[res] = (Math.max(0, Number(cap) || 0)) * (t + 1);
  }
  return out;
}

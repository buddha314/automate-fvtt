/**
 * The output pipeline tail (#46) — pure storage-cap + overflow-routing logic.
 *
 * After production lands in the stockpile each tick, resources are clamped to a
 * per-resource **capacity** and the excess is routed by an **overflow policy**:
 *   - `lost`      — discarded (Kingmaker default)
 *   - `buffered`  — held in the Keep's port buffers (the `overflow` buffer)
 *   - `auto-sold` — sold to a merchant for currency (falls back to lost with no buyer)
 *
 * Pure (no Foundry). The engine (`rules/rule-engine.js`) supplies the stockpile,
 * capacities, policy, and merchant prices, applies the result, and — for
 * Fabricate-managed resources — removes the overflow items so the cap sticks.
 *
 * @module rules/output-pipeline
 */

/** Buffer key the `buffered` overflow policy holds excess under. */
export const OVERFLOW_BUFFER = "overflow";

/**
 * Clamp a stockpile to per-resource capacities. Resources with no finite capacity
 * are left untouched. Pure.
 * @param {Object<string, number>} stockpile  resourceKey → quantity
 * @param {Object<string, number>} capacities  resourceKey → capacity (missing/∞ = uncapped)
 * @returns {{ clamped: Object<string, number>, overflow: Object<string, number> }}
 *   `clamped` is the new stockpile (over-cap keys set to their cap); `overflow` is the
 *   excess per resource (only keys that overflowed).
 */
export function computeOutputPlan(stockpile = {}, capacities = {}) {
  const clamped = { ...(stockpile ?? {}) };
  const overflow = {};
  for (const [res, amt] of Object.entries(stockpile ?? {})) {
    const cap = capacities?.[res];
    if (cap == null || !Number.isFinite(Number(cap))) continue;
    const over = Number(amt) - Number(cap);
    if (over > 0) {
      clamped[res] = Number(cap);
      overflow[res] = over;
    }
  }
  return { clamped, overflow };
}

/**
 * Route overflow amounts by policy into buffer deltas, sale revenue, or loss. Pure.
 * @param {Object<string, number>} overflow  resourceKey → excess
 * @param {"lost"|"buffered"|"auto-sold"} [policy="lost"]
 * @param {object} [opts]
 * @param {Object<string, number>} [opts.prices]  resourceKey → unit price (for `auto-sold`)
 * @returns {{ bufferDeltas: Object<string,number>, revenue: number,
 *            soldByResource: Object<string,number>, lostByResource: Object<string,number> }}
 */
export function routeOverflow(overflow = {}, policy = "lost", { prices = {} } = {}) {
  const bufferDeltas = {};
  const soldByResource = {};
  const lostByResource = {};
  let revenue = 0;
  for (const [res, raw] of Object.entries(overflow ?? {})) {
    const amt = Number(raw) || 0;
    if (amt <= 0) continue;
    const price = Number(prices?.[res] ?? 0) || 0;
    if (policy === "buffered") {
      bufferDeltas[res] = amt;
    } else if (policy === "auto-sold" && price > 0) {
      soldByResource[res] = amt;
      revenue += amt * price;
    } else {
      lostByResource[res] = amt; // `lost`, or `auto-sold` with no buyer
    }
  }
  return { bufferDeltas, revenue, soldByResource, lostByResource };
}

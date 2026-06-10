/**
 * The economy rules core (Phase 3).
 *
 * This module is **pure** — it imports nothing from Foundry, so the production
 * algorithm can be unit-tested off-platform (see `test/rules.test.js`). The
 * Foundry wiring (reading Keeps, writing stockpiles, subscribing to the tick
 * dispatcher, GM authority) lives in {@link module:rules/rule-engine}.
 *
 * A {@link Rule} converts a {@link RuleBinding}'s *unit count* into stockpile
 * deltas per elapsed interval. Every rule is **deterministic and idempotent
 * across large jumps**: advancing a year applies exactly N intervals, computed
 * from aligned interval boundaries — never one lump or a step-size-dependent
 * total. Backward time never un-produces.
 *
 * @module rules/rules
 */

import { SECONDS, intervalsElapsed } from "../time/time-util.js";

/**
 * Apply order when several rules touch the same resource in one tick. Producers
 * and converters create resources before consumers/upkeep spend them, so a tick
 * can feed a downstream rule from an upstream rule's output (matters for the
 * Phase 4 ore→ingot converter; the Phase 3 examples don't chain, but the order
 * is fixed now for determinism).
 * @type {RuleKind[]}
 */
export const KIND_ORDER = Object.freeze(["producer", "converter", "consumer", "upkeep"]);

/**
 * The three worked economy rules from the epic (#5). Count-based rules scale by
 * a Keep config scalar and have **no map presence, ever**; the producer is
 * *logical now* (`assetUnits: 1`) and becomes asset-driven in Phase 6 — at which
 * point `assetUnits` is replaced by the count of placed drills bound to the Keep.
 * @type {Rule[]}
 */
export const DEFAULT_RULES = Object.freeze([
  {
    // UC4: −1 sp/day per henchman. Permanently count-based.
    id: "henchmen-upkeep",
    kind: "upkeep",
    binding: "count",
    countKey: "henchmen",
    intervalSeconds: SECONDS.day,
    inputs: { sp: 1 },
    outputs: {},
  },
  {
    // UC5: +2 rations/day per garden unit. Permanently count-based.
    id: "garden-rations",
    kind: "converter",
    binding: "count",
    countKey: "garden",
    intervalSeconds: SECONDS.day,
    inputs: {},
    outputs: { rations: 2 },
  },
  {
    // UC2 (logical): 1 ore/sec. Realized as a placed drill asset in Phase 6.
    id: "ore-drill",
    kind: "producer",
    binding: "asset",
    assetUnits: 1,
    intervalSeconds: 1,
    inputs: {},
    outputs: { ore: 1 },
  },
]);

/** @type {Map<string, Rule>} */
const registry = new Map(DEFAULT_RULES.map((r) => [r.id, r]));

/**
 * Register (or replace) a rule. Re-registering an existing id overwrites it.
 * @param {Rule} rule
 */
export function registerRule(rule) {
  if (!rule?.id) throw new Error("[automate-fvtt] rule needs an id");
  registry.set(rule.id, rule);
}

/** Remove a rule. @param {string} id */
export function unregisterRule(id) {
  registry.delete(id);
}

/** Restore the registry to exactly the default rule set (used by tests). */
export function resetRules() {
  registry.clear();
  for (const r of DEFAULT_RULES) registry.set(r.id, r);
}

/** @returns {Rule[]} all registered rules. */
export function listRules() {
  return [...registry.values()];
}

/**
 * How many *units* of a rule a Keep currently runs.
 * - `count`  → the Keep config scalar named by `rule.countKey` (henchmen, garden).
 * - `asset`  → `rule.assetUnits` (Phase 3 stand-in; Phase 6 replaces this with
 *   the number of placed assets bound to the Keep).
 * A unit count of 0 makes the rule a no-op for that Keep.
 * @param {{counts?: Object<string, number>}} keepSystem  the Keep's `system` data
 * @param {Rule} rule
 * @returns {number} non-negative unit count
 */
export function unitsFor(keepSystem, rule) {
  let n = 0;
  if (rule.binding === "count") n = Number(keepSystem?.counts?.[rule.countKey] ?? 0);
  else if (rule.binding === "asset") n = Number(rule.assetUnits ?? 0);
  return n > 0 ? n : 0;
}

/** Rules sorted into deterministic apply order. @param {Rule[]} rules @returns {Rule[]} */
function sortRules(rules) {
  return [...rules].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

/**
 * Compute the stockpile changes a set of rules makes to one Keep over a world-time
 * span — the heart of the engine, and pure so it is fully unit-testable.
 *
 * For each rule (in {@link KIND_ORDER}): take the whole intervals crossed between
 * `prevTime` and `worldTime`, scale by the Keep's unit count, then **cap the
 * applied intervals by available inputs** so a conversion never drives a resource
 * negative — the principled form of "clamping / conflict resolution". Inputs are
 * spent and outputs banked against a working copy of the stockpile, so an earlier
 * rule's output is visible to a later rule's input within the same tick.
 *
 * Backward or sub-interval time yields zero intervals → no change (guards the
 * classic backward-time accrual bug).
 *
 * @param {Object<string, number>} stockpile  current resource → qty (not mutated)
 * @param {{counts?: Object<string, number>}} keepSystem  the Keep's `system` data
 * @param {Rule[]} rules
 * @param {number} prevTime   previous world time, seconds
 * @param {number} worldTime  new world time, seconds
 * @returns {{deltas: Object<string, number>, applications: {ruleId: string, units: number, intervals: number}[], result: Object<string, number>}}
 *   `deltas` = net change per resource; `applications` = what actually fired;
 *   `result` = the resulting stockpile (working copy).
 */
export function computeTickPlan(stockpile, keepSystem, rules, prevTime, worldTime) {
  const work = { ...(stockpile ?? {}) };
  const deltas = {};
  const applications = [];

  for (const rule of sortRules(rules)) {
    const units = unitsFor(keepSystem, rule);
    if (units <= 0) continue;

    let intervals = intervalsElapsed(prevTime, worldTime, rule.intervalSeconds);
    if (intervals <= 0) continue; // backward / no full interval → nothing

    // Cap by the scarcest input so we never overdraw a resource.
    for (const [res, amt] of Object.entries(rule.inputs ?? {})) {
      const perInterval = units * amt;
      if (perInterval <= 0) continue;
      const avail = Math.max(0, Number(work[res] ?? 0));
      intervals = Math.min(intervals, Math.floor(avail / perInterval));
    }
    if (intervals <= 0) continue;

    for (const [res, amt] of Object.entries(rule.inputs ?? {})) {
      const d = -(units * amt * intervals);
      work[res] = Number(work[res] ?? 0) + d;
      deltas[res] = (deltas[res] ?? 0) + d;
    }
    for (const [res, amt] of Object.entries(rule.outputs ?? {})) {
      const d = units * amt * intervals;
      work[res] = Number(work[res] ?? 0) + d;
      deltas[res] = (deltas[res] ?? 0) + d;
    }
    applications.push({ ruleId: rule.id, units, intervals });
  }

  return { deltas, applications, result: work };
}

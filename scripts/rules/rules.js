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
 * Where an asset-bound producer's output lands. Adjacency is **optional**: a
 * producer can deposit straight into the Keep, or hold output at a port for a
 * belt to route later.
 * - `keep`  — deposit output directly into the Keep stockpile. No belt required.
 * - `port`  — accumulate output in a per-asset buffer on the Keep, to be drained
 *   by adjacency routing (Phase 7) or collected manually.
 *
 * Count-bound rules (henchmen, garden) have no map presence and therefore always
 * deliver to the Keep — see {@link effectiveDelivery}.
 * @enum {string}
 */
export const DELIVERY = Object.freeze({ KEEP: "keep", PORT: "port" });

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
    // Deposits straight into the Keep by default — adjacency/belts are optional.
    id: "ore-drill",
    kind: "producer",
    binding: "asset",
    assetUnits: 1,
    intervalSeconds: 1,
    inputs: {},
    outputs: { ore: 1 },
    delivery: DELIVERY.KEEP,
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
 * A Keep's `system` data, as the rules core reads it.
 * @typedef {Object} KeepSystem
 * @property {Object<string, number>} [counts]  count-binding scalars (henchmen, garden, …)
 */

/**
 * How many *units* of a rule a Keep currently runs.
 * - `count`  → the Keep config scalar named by `rule.countKey` (henchmen, garden).
 * - `asset`  → `rule.assetUnits` (Phase 3 stand-in; Phase 6 replaces this with
 *   the number of placed assets bound to the Keep).
 * A unit count of 0 makes the rule a no-op for that Keep.
 * @param {KeepSystem} keepSystem  the Keep's `system` data
 * @param {Rule} rule
 * @returns {number} non-negative unit count
 */
export function unitsFor(keepSystem, rule) {
  let n = 0;
  if (rule.binding === "count") n = Number(keepSystem?.counts?.[rule.countKey] ?? 0);
  else if (rule.binding === "asset") n = Number(rule.assetUnits ?? 0);
  return n > 0 ? n : 0;
}

/**
 * Resolve where a rule's output goes. Count-bound rules have no port and always
 * deliver to the Keep; an asset-bound rule uses its own `delivery`, falling back
 * to the world default.
 * @param {Rule} rule
 * @param {DELIVERY} [defaultDelivery=DELIVERY.KEEP]  world-configured default for
 *   asset rules that don't set their own
 * @returns {DELIVERY}
 */
export function effectiveDelivery(rule, defaultDelivery = DELIVERY.KEEP) {
  if (rule.binding !== "asset") return DELIVERY.KEEP;
  return rule.delivery ?? defaultDelivery;
}

/**
 * Buffer key for a port-delivering rule's output on the Keep. Keyed by the
 * source asset when one exists (Phase 6), else by rule id.
 * @param {Rule} rule
 * @returns {string}
 */
export function bufferKeyFor(rule) {
  return rule.assetId ?? rule.id;
}

/**
 * Reconfigure a registered rule's delivery mode in place.
 * @param {string} id
 * @param {DELIVERY} mode
 * @returns {Rule} the updated rule
 */
export function setDelivery(id, mode) {
  const rule = registry.get(id);
  if (!rule) throw new Error(`[automate-fvtt] no such rule: ${id}`);
  if (mode !== DELIVERY.KEEP && mode !== DELIVERY.PORT) {
    throw new Error(`[automate-fvtt] invalid delivery mode: ${mode}`);
  }
  const updated = { ...rule, delivery: mode };
  registry.set(id, updated);
  return updated;
}

/** Rules sorted into deterministic apply order. @param {Rule[]} rules @returns {Rule[]} */
function sortRules(rules) {
  return [...rules].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

/**
 * One rule's contribution to a tick.
 * @typedef {Object} TickApplication
 * @property {string} ruleId
 * @property {number} units
 * @property {number} intervals
 * @property {DELIVERY} delivery
 */

/**
 * Options for {@link computeTickPlan}.
 * @typedef {Object} TickOptions
 * @property {DELIVERY} [defaultDelivery]  default delivery for asset rules that
 *   don't set their own (the world setting)
 */

/**
 * The result of {@link computeTickPlan}.
 * @typedef {Object} TickPlan
 * @property {Object<string, number>} deltas  net stockpile change per resource
 * @property {Object<string, Object<string, number>>} ports  bufferKey → resource → amount held at a port
 * @property {TickApplication[]} applications  what actually fired
 * @property {Object<string, number>} result  the resulting stockpile (working copy)
 */

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
 * Outputs route by {@link effectiveDelivery}: `keep` outputs land in `deltas`
 * (and the working copy, so a later rule can consume them this tick); `port`
 * outputs land in `ports` (a separate per-buffer map) and are **not** added to
 * the stockpile — they await routing/collection. Inputs always draw from the
 * stockpile.
 *
 * @param {Object<string, number>} stockpile  current resource → qty (not mutated)
 * @param {KeepSystem} keepSystem  the Keep's `system` data
 * @param {Rule[]} rules
 * @param {number} prevTime   previous world time, seconds
 * @param {number} worldTime  new world time, seconds
 * @param {TickOptions} [opts]  default delivery for asset rules that don't set their own
 * @returns {TickPlan}  `deltas` = net stockpile change per resource; `ports` =
 *   bufferKey → resource → amount held at a port; `applications` = what actually
 *   fired; `result` = the resulting stockpile (working copy).
 */
export function computeTickPlan(stockpile, keepSystem, rules, prevTime, worldTime, opts = {}) {
  const defaultDelivery = opts.defaultDelivery ?? DELIVERY.KEEP;
  const work = { ...(stockpile ?? {}) };
  const deltas = {};
  const ports = {};
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

    const delivery = effectiveDelivery(rule, defaultDelivery);
    const bufferKey = delivery === DELIVERY.PORT ? bufferKeyFor(rule) : null;
    for (const [res, amt] of Object.entries(rule.outputs ?? {})) {
      const d = units * amt * intervals;
      if (delivery === DELIVERY.PORT) {
        (ports[bufferKey] ??= {})[res] = (ports[bufferKey][res] ?? 0) + d;
      } else {
        work[res] = Number(work[res] ?? 0) + d;
        deltas[res] = (deltas[res] ?? 0) + d;
      }
    }
    applications.push({ ruleId: rule.id, units, intervals, delivery });
  }

  return { deltas, ports, applications, result: work };
}

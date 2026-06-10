/**
 * Unit tests for the Phase 3 rules core. Runs under Node's built-in runner
 * (`npm test` → `node --test`) with no dependencies — the module under test is
 * pure and imports nothing from Foundry.
 *
 * Covers the epic's "Done when" (stockpiles change per all three rules, correct
 * for arbitrary dt including a full year) plus the determinism, clamping, and
 * backward-time guarantees.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { SECONDS } from "../scripts/time/time-util.js";
import {
  DEFAULT_RULES,
  computeTickPlan,
  unitsFor,
  resetRules,
  listRules,
  registerRule,
} from "../scripts/rules/rules.js";

/** A Keep `system` blob like Phase 1 persists. */
const keepSystem = ({ henchmen = 0, garden = 0 } = {}) => ({ counts: { henchmen, garden } });

/** Run the default rules over a span and return the plan. */
const plan = (stockpile, system, from, to) =>
  computeTickPlan(stockpile, system, DEFAULT_RULES, from, to);

test("unitsFor reads count scalars and the asset stand-in", () => {
  const sys = keepSystem({ henchmen: 3, garden: 2 });
  assert.equal(unitsFor(sys, DEFAULT_RULES.find((r) => r.id === "henchmen-upkeep")), 3);
  assert.equal(unitsFor(sys, DEFAULT_RULES.find((r) => r.id === "garden-rations")), 2);
  assert.equal(unitsFor(sys, DEFAULT_RULES.find((r) => r.id === "ore-drill")), 1);
});

test("a single day applies each count rule once per unit (UC4 + UC5)", () => {
  const sys = keepSystem({ henchmen: 2, garden: 3 });
  const { result } = plan({ sp: 100, rations: 5, ore: 0 }, sys, 0, SECONDS.day);
  assert.equal(result.sp, 100 - 2); // -1 sp/day x 2 henchmen
  assert.equal(result.rations, 5 + 6); // +2 rations/day x 3 garden
});

test("the logical producer yields 1 ore per second (UC2)", () => {
  const { result } = plan({ ore: 0 }, keepSystem(), 0, 60);
  assert.equal(result.ore, 60);
});

test("a one-year jump equals 365 days / 1 year of seconds, in one step", () => {
  const sys = keepSystem({ henchmen: 1, garden: 1 });
  const { result } = plan({ sp: 1000, rations: 0, ore: 0 }, sys, 0, SECONDS.year);
  assert.equal(result.sp, 1000 - 365); // 365 daily upkeeps
  assert.equal(result.rations, 2 * 365); // 365 daily +2
  assert.equal(result.ore, SECONDS.year); // 1/sec for a year
});

test("idempotent across step size: one big jump == many small steps", () => {
  const sys = keepSystem({ henchmen: 2, garden: 4 });
  const start = { sp: 10000, rations: 0, ore: 0 };

  const oneShot = plan(start, sys, 0, SECONDS.year).result;

  // Walk the same span one day at a time, threading the stockpile forward.
  let acc = { ...start };
  for (let t = SECONDS.day; t <= SECONDS.year; t += SECONDS.day) {
    acc = plan(acc, sys, t - SECONDS.day, t).result;
  }

  assert.equal(acc.sp, oneShot.sp);
  assert.equal(acc.rations, oneShot.rations);
  // Ore is sub-day; the daily walk only credits whole days, so compare the
  // resources the daily rules drive and check ore separately at second scale.
  assert.equal(oneShot.ore, SECONDS.year);
});

test("count of 0 makes a rule a no-op", () => {
  const { result, applications } = plan({ sp: 50, rations: 0, ore: 0 }, keepSystem(), 0, SECONDS.day);
  assert.equal(result.sp, 50); // no henchmen
  assert.equal(result.rations, 0); // no garden
  assert.ok(!applications.some((a) => a.ruleId === "henchmen-upkeep"));
  assert.ok(!applications.some((a) => a.ruleId === "garden-rations"));
});

test("inputs are capped at availability — upkeep never goes negative", () => {
  // 2 henchmen, only 5 sp, over 10 days: cost would be 20 sp.
  const sys = keepSystem({ henchmen: 2 });
  const { result, applications } = plan({ sp: 5 }, sys, 0, 10 * SECONDS.day);
  assert.ok(result.sp >= 0, "sp must not go negative");
  // floor(5 / (2 sp/day)) = 2 affordable days → 4 sp spent, 1 left.
  assert.equal(result.sp, 1);
  assert.equal(applications.find((a) => a.ruleId === "henchmen-upkeep").intervals, 2);
});

test("backward or sub-interval time produces nothing", () => {
  const sys = keepSystem({ henchmen: 5, garden: 5 });
  const back = plan({ sp: 100, rations: 100, ore: 100 }, sys, SECONDS.year, 0);
  assert.deepEqual(back.deltas, {}, "rewind must not change stockpiles");

  const subInterval = plan({ sp: 100 }, sys, 0, SECONDS.day - 1); // < 1 day
  assert.equal(subInterval.deltas.sp ?? 0, 0);
});

test("registry can be extended and reset", () => {
  resetRules();
  assert.equal(listRules().length, DEFAULT_RULES.length);
  registerRule({ id: "custom", kind: "producer", binding: "asset", assetUnits: 2, intervalSeconds: SECONDS.hour, inputs: {}, outputs: { mana: 1 } });
  assert.equal(listRules().length, DEFAULT_RULES.length + 1);
  const { result } = computeTickPlan({}, keepSystem(), listRules(), 0, 2 * SECONDS.hour);
  assert.equal(result.mana, 4); // 2 units x 1/hour x 2 hours
  resetRules();
  assert.equal(listRules().length, DEFAULT_RULES.length);
});

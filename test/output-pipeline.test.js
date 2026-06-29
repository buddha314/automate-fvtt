/**
 * Unit tests for the pure output pipeline (#46) — caps + overflow routing.
 * `node --test`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeOutputPlan, routeOverflow, OVERFLOW_BUFFER } from "../scripts/rules/output-pipeline.js";

test("computeOutputPlan clamps over-cap resources and reports overflow", () => {
  const { clamped, overflow } = computeOutputPlan({ ore: 30, gold: 5, wood: 12 }, { ore: 20, wood: 12 });
  assert.equal(clamped.ore, 20);
  assert.equal(overflow.ore, 10);
  assert.equal(clamped.gold, 5); // uncapped → untouched
  assert.equal(overflow.gold, undefined);
  assert.equal(clamped.wood, 12); // exactly at cap → no overflow
  assert.equal(overflow.wood, undefined);
});

test("computeOutputPlan ignores missing/infinite caps and does not mutate input", () => {
  const stock = { ore: 100 };
  const { clamped, overflow } = computeOutputPlan(stock, { ore: Infinity });
  assert.deepEqual(overflow, {});
  assert.equal(clamped.ore, 100);
  assert.equal(stock.ore, 100); // input untouched
});

test("routeOverflow: lost discards", () => {
  const r = routeOverflow({ ore: 10 }, "lost");
  assert.deepEqual(r.lostByResource, { ore: 10 });
  assert.equal(r.revenue, 0);
  assert.deepEqual(r.bufferDeltas, {});
});

test("routeOverflow: buffered holds the excess", () => {
  const r = routeOverflow({ ore: 10, wood: 3 }, "buffered");
  assert.deepEqual(r.bufferDeltas, { ore: 10, wood: 3 });
  assert.equal(r.revenue, 0);
});

test("routeOverflow: auto-sold sells at price, no-buyer falls back to lost", () => {
  const r = routeOverflow({ ore: 10, gems: 2 }, "auto-sold", { prices: { ore: 3 } });
  assert.equal(r.revenue, 30); // ore 10 × 3
  assert.deepEqual(r.soldByResource, { ore: 10 });
  assert.deepEqual(r.lostByResource, { gems: 2 }); // no price → lost
});

test("OVERFLOW_BUFFER is the buffer key", () => {
  assert.equal(OVERFLOW_BUFFER, "overflow");
});

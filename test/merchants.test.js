/**
 * Unit tests for the pure merchant logic (model + MERCHANT.md weighted restock).
 * `node --test`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  makeMerchant,
  candidateWeights,
  pickWeighted,
  restockStock,
  isRestockDue,
  DEFAULT_RESTOCK_SECONDS,
} from "../scripts/merchants/merchants.js";

/* ------------------------------------------------------------------ */
/* model                                                               */
/* ------------------------------------------------------------------ */

test("makeMerchant fills defaults and clamps", () => {
  const m = makeMerchant({ id: "m1" });
  assert.equal(m.type, "trader");
  assert.equal(m.capacity, 5);
  assert.deepEqual(m.stock, []);
  assert.equal(m.restock.intervalSeconds, DEFAULT_RESTOCK_SECONDS);
  assert.equal(m.restock.weighting, "inverseValue");
  assert.equal(m.restock.rarityBias, 0);
});

test("makeMerchant requires an id and clamps rarityBias/capacity", () => {
  assert.throws(() => makeMerchant({}));
  const m = makeMerchant({ id: "m", capacity: -3, restock: { rarityBias: 5, weighting: "bogus" } });
  assert.equal(m.capacity, 0);
  assert.equal(m.restock.rarityBias, 1); // clamped to [0,1]
  assert.equal(m.restock.weighting, "inverseValue"); // invalid → default
});

/* ------------------------------------------------------------------ */
/* weighting                                                            */
/* ------------------------------------------------------------------ */

const CANDS = [
  { itemUuid: "cheap", baseValue: 1 },
  { itemUuid: "mid", baseValue: 4 },
  { itemUuid: "rare", baseValue: 10 },
];

test("candidateWeights inverseValue favors cheaper items", () => {
  const w = candidateWeights(CANDS, "inverseValue", 0);
  assert.ok(w[0] > w[1] && w[1] > w[2], "cheap > mid > rare");
  const sum = w.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, "inverse shares sum to 1");
});

test("candidateWeights rarityBias shifts toward expensive", () => {
  const inv = candidateWeights(CANDS, "inverseValue", 0);
  const biased = candidateWeights(CANDS, "inverseValue", 1);
  assert.ok(biased[2] > inv[2], "rare gets more weight at bias 1");
  assert.ok(biased[2] > biased[0], "at full bias, rare > cheap");
});

test("candidateWeights uniform and explicit", () => {
  assert.deepEqual(candidateWeights(CANDS, "uniform"), [1, 1, 1]);
  const ex = [{ itemUuid: "a", baseValue: 1, weight: 3 }, { itemUuid: "b", baseValue: 9, weight: 1 }];
  assert.deepEqual(candidateWeights(ex, "explicit"), [3, 1]);
});

test("candidateWeights handles empty and all-zero values", () => {
  assert.deepEqual(candidateWeights([]), []);
  assert.deepEqual(candidateWeights([{ itemUuid: "a", baseValue: 0 }, { itemUuid: "b", baseValue: 0 }], "inverseValue"), [1, 1]);
});

/* ------------------------------------------------------------------ */
/* picking + restock                                                   */
/* ------------------------------------------------------------------ */

test("pickWeighted is proportional and handles the boundaries", () => {
  // weights [1,3] → r in [0,1) picks 0, [1,4) picks 1
  assert.equal(pickWeighted([1, 3], () => 0), 0); // r=0 → idx0
  assert.equal(pickWeighted([1, 3], () => 0.2), 0); // r=0.8 < 1 → idx0
  assert.equal(pickWeighted([1, 3], () => 0.9), 1); // r=3.6 → past idx0 (w=1) → idx1
  assert.equal(pickWeighted([0, 0], () => 0.5), -1);
});

test("restockStock draws to capacity with replacement, stacking duplicates", () => {
  // Deterministic rng cycling through fixed values.
  const seq = [0.0, 0.99, 0.0, 0.99]; let i = 0;
  const rng = () => seq[i++ % seq.length];
  const stock = restockStock({ candidates: CANDS, weighting: "uniform" }, 4, rng);
  const total = stock.reduce((a, s) => a + s.quantity, 0);
  assert.equal(total, 4, "exactly capacity items drawn");
  // price carried from baseValue
  for (const s of stock) {
    const c = CANDS.find((x) => x.itemUuid === s.itemUuid);
    assert.equal(s.price, c.baseValue);
  }
});

test("restockStock is empty with no candidates or zero capacity", () => {
  assert.deepEqual(restockStock({ candidates: [] }, 5), []);
  assert.deepEqual(restockStock({ candidates: CANDS }, 0), []);
});

/* ------------------------------------------------------------------ */
/* cadence                                                             */
/* ------------------------------------------------------------------ */

test("isRestockDue: never-stocked is due; interval gates the rest", () => {
  assert.equal(isRestockDue(makeMerchant({ id: "m" }), 0), true); // lastRestockAt null
  const m = makeMerchant({ id: "m", restock: { intervalSeconds: 100, lastRestockAt: 1000 } });
  assert.equal(isRestockDue(m, 1099), false);
  assert.equal(isRestockDue(m, 1100), true);
});

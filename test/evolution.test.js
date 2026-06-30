/**
 * Unit tests for the pure Keep-evolution logic (tier computation + derivations).
 * `node --test`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIER_TABLE,
  computeTier,
  tierName,
  capacitiesForTier,
} from "../scripts/evolution/evolution.js";

test("computeTier resolves the highest met bracket", () => {
  assert.equal(computeTier({}), 0); // hamlet
  assert.equal(computeTier({ population: 150 }), 1); // village
  assert.equal(computeTier({ population: 1000, area: 20 }), 2); // town
  assert.equal(computeTier({ population: 50000, area: 100 }), 3); // city (pop≥10k, area≥100)
});

test("computeTier requires ALL of a bracket's minimums", () => {
  // population for town met, but area below 20 → stays village
  assert.equal(computeTier({ population: 5000, area: 5 }), 1);
  // area high but population low → hamlet
  assert.equal(computeTier({ area: 1000, population: 0 }), 0);
});

test("computeTier honors a custom table", () => {
  const table = [
    { tier: 0, name: "outpost", min: {} },
    { tier: 1, name: "fort", min: { order: 5 } },
  ];
  assert.equal(computeTier({ order: 10 }, table), 1);
  assert.equal(computeTier({ order: 2 }, table), 0);
});

test("tierName maps tier to its label", () => {
  assert.equal(tierName(0), "hamlet");
  assert.equal(tierName(2), "town");
  assert.equal(tierName(99), "99"); // unknown → numeric string
});

test("capacitiesForTier scales base caps by (tier + 1)", () => {
  assert.deepEqual(capacitiesForTier(0, { ore: 10 }), { ore: 10 });
  assert.deepEqual(capacitiesForTier(2, { ore: 10, wood: 5 }), { ore: 30, wood: 15 });
  assert.deepEqual(capacitiesForTier(3, {}), {}); // no base → no caps
});

test("DEFAULT_TIER_TABLE is ordered from tier 0", () => {
  assert.equal(DEFAULT_TIER_TABLE[0].tier, 0);
  assert.equal(DEFAULT_TIER_TABLE[0].name, "hamlet");
});

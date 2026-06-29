/**
 * Unit tests for the membership-benefits core (Change A — keep-benefits). Runs
 * under Node's built-in runner (`npm test` → `node --test`) with no
 * dependencies — the modules under test are pure and import nothing from Foundry.
 *
 * Covers the spec's requirements: definition validation + mode default,
 * eligibility gating (role / tier / while-present condition), idempotent
 * resolution, modifier stacking (highest-wins default + overrides), capability
 * resolution, and the side-module store.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PRIMITIVE,
  MODE,
  CONDITION,
  COMBINE,
  validateDefinition,
  isLive,
  computeResolution,
  appliedBenefits,
  resolveModifiers,
  resolveCapabilities,
} from "../scripts/benefits/benefits.js";
import {
  registerDefinition,
  unregisterDefinition,
  listDefinitions,
  getDefinition,
  bind,
  unbind,
  bindingsFor,
  definitionsForKeep,
  resetStore,
} from "../scripts/benefits/benefit-store.js";
import { importPf2eKingmakerStructures, importBenefits } from "../scripts/benefits/importers.js";
import { registerGenericCookbook, GENERIC_COOKBOOK } from "../scripts/benefits/cookbook.js";

const def = (over = {}) => ({ id: "b", primitive: PRIMITIVE.MODIFIER, payload: { key: "k", value: 1 }, ...over });

test("validateDefinition defaults mode=interactive and condition=always", () => {
  const d = validateDefinition(def());
  assert.equal(d.mode, MODE.INTERACTIVE);
  assert.equal(d.condition, CONDITION.ALWAYS);
  assert.deepEqual(d.eligibility, { roles: [], minTier: 0 });
});

test("validateDefinition rejects missing id and unknown primitive", () => {
  assert.throws(() => validateDefinition({ primitive: PRIMITIVE.EFFECT }), /needs an id/);
  assert.throws(() => validateDefinition({ id: "x", primitive: "teleport" }), /invalid primitive/);
});

test("isLive gates on role", () => {
  const d = validateDefinition(def({ eligibility: { roles: ["owner"] } }));
  assert.equal(isLive(d, { role: "owner" }), true);
  assert.equal(isLive(d, { role: "resident" }), false);
  // empty roles = any role
  const any = validateDefinition(def());
  assert.equal(isLive(any, { role: "anyone" }), true);
});

test("isLive gates on tier", () => {
  const d = validateDefinition(def({ eligibility: { minTier: 3 } }));
  assert.equal(isLive(d, { role: "r", tier: 3 }), true);
  assert.equal(isLive(d, { role: "r", tier: 2 }), false);
  assert.equal(isLive(d, { role: "r" }), false); // default tier 0 < 3
});

test("isLive gates on the while-present condition", () => {
  const d = validateDefinition(def({ condition: CONDITION.WHILE_PRESENT }));
  assert.equal(isLive(d, { role: "r", present: true }), true);
  assert.equal(isLive(d, { role: "r", present: false }), false);
  assert.equal(isLive(d, { role: "r" }), false);
});

test("computeResolution is idempotent for identical inputs", () => {
  const defs = [validateDefinition(def({ id: "a" })), validateDefinition(def({ id: "b", eligibility: { minTier: 9 } }))];
  const ctx = { role: "owner", tier: 1, present: true };
  const r1 = computeResolution(ctx, defs);
  const r2 = computeResolution(ctx, defs);
  assert.deepEqual(r1, r2);
  assert.deepEqual(r1.benefits.map((b) => b.id), ["a"]); // b gated out by tier
});

test("appliedBenefits includes auto plus approved interactive", () => {
  const benefits = [
    { id: "auto1", mode: MODE.AUTO, primitive: PRIMITIVE.MODIFIER, payload: {} },
    { id: "int1", mode: MODE.INTERACTIVE, primitive: PRIMITIVE.MODIFIER, payload: {} },
    { id: "int2", mode: MODE.INTERACTIVE, primitive: PRIMITIVE.MODIFIER, payload: {} },
  ];
  const got = appliedBenefits(benefits, new Set(["int1"])).map((b) => b.id);
  assert.deepEqual(got, ["auto1", "int1"]);
});

test("resolveModifiers is highest-wins by default", () => {
  const benefits = [
    { primitive: PRIMITIVE.MODIFIER, payload: { key: "atk", value: 1 } },
    { primitive: PRIMITIVE.MODIFIER, payload: { key: "atk", value: 3 } },
    { primitive: PRIMITIVE.MODIFIER, payload: { key: "atk", value: 2 } },
  ];
  assert.equal(resolveModifiers(benefits).atk, 3);
});

test("resolveModifiers honors per-key combine overrides", () => {
  assert.equal(
    resolveModifiers([
      { primitive: PRIMITIVE.MODIFIER, payload: { key: "price", value: 0.9, combine: COMBINE.LOWEST } },
      { primitive: PRIMITIVE.MODIFIER, payload: { key: "price", value: 0.75, combine: COMBINE.LOWEST } },
    ]).price,
    0.75
  );
  assert.equal(
    resolveModifiers([
      { primitive: PRIMITIVE.MODIFIER, payload: { key: "rep", value: 2, combine: COMBINE.ADDITIVE } },
      { primitive: PRIMITIVE.MODIFIER, payload: { key: "rep", value: 3, combine: COMBINE.ADDITIVE } },
    ]).rep,
    5
  );
});

test("resolveCapabilities yields flags and summed quotas", () => {
  const caps = resolveCapabilities([
    { primitive: PRIMITIVE.CAPABILITY, payload: { key: "vote" } },
    { primitive: PRIMITIVE.CAPABILITY, payload: { key: "storage", quota: 10 } },
    { primitive: PRIMITIVE.CAPABILITY, payload: { key: "storage", quota: 5 } },
  ]);
  assert.equal(caps.vote, true);
  assert.equal(caps.storage, 15);
});

test("store registers, lists, gets, and resets definitions", () => {
  resetStore();
  registerDefinition(def({ id: "x" }));
  assert.equal(listDefinitions().length, 1);
  assert.equal(getDefinition("x").mode, MODE.INTERACTIVE);
  unregisterDefinition("x");
  assert.equal(listDefinitions().length, 0);
  resetStore();
});

test("store binds benefits per keep and applies overrides", () => {
  resetStore();
  registerDefinition(def({ id: "rest", eligibility: { minTier: 0 } }));
  bind("keep1", "rest", { eligibility: { minTier: 5 } });
  assert.deepEqual(bindingsFor("keep1").map((b) => b.benefitId), ["rest"]);
  const resolved = definitionsForKeep("keep1");
  assert.equal(resolved[0].eligibility.minTier, 5); // override applied
  unbind("keep1", "rest");
  assert.equal(definitionsForKeep("keep1").length, 0);
  resetStore();
});

test("definitionsForKeep skips bindings whose definition is gone", () => {
  resetStore();
  bind("keep1", "ghost");
  assert.equal(definitionsForKeep("keep1").length, 0);
  resetStore();
});

test("PF2e Kingmaker importer maps structure bonuses to review-ready modifier defs", () => {
  const defs = importPf2eKingmakerStructures([
    { name: "Tavern", level: 1, itemBonuses: [{ activity: "Gather Information", value: 1 }] },
    { name: "Empty Lot", itemBonuses: [] },
  ]);
  assert.equal(defs.length, 1);
  assert.equal(defs[0].id, "pf2e.structure.tavern.gather-information");
  assert.equal(defs[0].primitive, PRIMITIVE.MODIFIER);
  assert.equal(defs[0].payload.key, "pf2e.gather-information.itemBonus");
  assert.equal(defs[0].payload.value, 1);
  assert.equal(defs[0].condition, CONDITION.WHILE_PRESENT);
});

test("importBenefits returns validated defs and never auto-registers", () => {
  resetStore();
  const defs = importBenefits([{ k: "v" }], () => ({ id: "imp", primitive: PRIMITIVE.CAPABILITY, payload: { key: "x" } }));
  assert.equal(defs.length, 1);
  assert.equal(defs[0].mode, MODE.INTERACTIVE); // normalized
  assert.equal(listDefinitions().length, 0); // import does not register
  resetStore();
});

test("generic cookbook registers idempotently and stays system-agnostic", () => {
  resetStore();
  registerGenericCookbook();
  registerGenericCookbook(); // idempotent by id
  assert.equal(listDefinitions().length, GENERIC_COOKBOOK.length);
  // The generic set ships no `effect` primitive (AE payloads belong to content).
  assert.ok(!GENERIC_COOKBOOK.some((d) => d.primitive === PRIMITIVE.EFFECT));
  resetStore();
});

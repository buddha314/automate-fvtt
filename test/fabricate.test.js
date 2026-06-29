/**
 * Unit tests for the Phase 4 Fabricate bridge — the pure halves only
 * (component mapping + ops planning). The adapter and engine wiring touch
 * Foundry/Fabricate and are exercised in a live world, not here.
 *
 * Runs under Node's built-in runner (`npm test` → `node --test`).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { SECONDS } from "../scripts/time/time-util.js";
import { computeTickPlan } from "../scripts/rules/rules.js";
import {
  createComponentMap,
  componentToResource,
  resourceToComponent,
  managedResourceKeys,
  projectInventory,
  applyProjection,
  buildComponentSourceIndex,
  matchComponentId,
  itemQuantity,
  scanComponentInventory,
} from "../scripts/fabricate/component-map.js";
import {
  FAB_OP,
  isFabricateRule,
  makeFabricateRule,
  planFabricateOps,
} from "../scripts/fabricate/fabricate-rules.js";

/* ------------------------------------------------------------------ */
/* component-map                                                       */
/* ------------------------------------------------------------------ */

test("component map resolves both directions and falls back to identity", () => {
  const map = createComponentMap([
    { componentId: "fab.iron-ore", resourceKey: "ore" },
    { componentId: "fab.iron-ingot", resourceKey: "ingot" },
  ]);
  assert.equal(componentToResource(map, "fab.iron-ore"), "ore");
  assert.equal(resourceToComponent(map, "ingot"), "fab.iron-ingot");
  // Unmapped ids pass through unchanged (identity fallback).
  assert.equal(componentToResource(map, "fab.mystery"), "fab.mystery");
  assert.equal(resourceToComponent(map, "sp"), "sp");
});

test("managedResourceKeys reports only the explicitly mapped resources", () => {
  const map = createComponentMap([{ componentId: "fab.iron-ore", resourceKey: "ore" }]);
  assert.deepEqual([...managedResourceKeys(map)], ["ore"]);
});

test("projectInventory folds components into resource totals", () => {
  const map = createComponentMap([
    { componentId: "fab.iron-ore", resourceKey: "ore" },
    { componentId: "fab.copper-ore", resourceKey: "ore" }, // both project to ore
  ]);
  const projection = projectInventory(
    { "fab.iron-ore": 4, "fab.copper-ore": 3, "fab.iron-ingot": 2 },
    map
  );
  assert.equal(projection.ore, 7); // 4 + 3 summed
  assert.equal(projection["fab.iron-ingot"], 2); // unmapped → identity key
});

test("applyProjection makes Fabricate authoritative for managed keys only", () => {
  const map = createComponentMap([{ componentId: "fab.iron-ore", resourceKey: "ore" }]);
  const stockpile = { ore: 99, sp: 50, rations: 12 };
  const projection = { ore: 7 }; // Fabricate now holds 7 ore Items
  const result = applyProjection(stockpile, projection, map);
  assert.equal(result.ore, 7); // overwritten by projection
  assert.equal(result.sp, 50); // numeric resource untouched
  assert.equal(result.rations, 12);
});

test("applyProjection zeroes a managed key whose component is depleted", () => {
  const map = createComponentMap([{ componentId: "fab.iron-ore", resourceKey: "ore" }]);
  const result = applyProjection({ ore: 20, sp: 5 }, {}, map);
  assert.equal(result.ore, 0); // managed but absent from projection → 0
  assert.equal(result.sp, 5);
});

test("applyProjection is pure (does not mutate inputs)", () => {
  const map = createComponentMap([{ componentId: "c", resourceKey: "ore" }]);
  const stockpile = { ore: 1 };
  applyProjection(stockpile, { ore: 9 }, map);
  assert.equal(stockpile.ore, 1); // original unchanged
});

/* ------------------------------------------------------------------ */
/* inventory scan (the readInventory core — match owned Items to        */
/* components by source reference, since Fabricate has no getInventory)  */
/* ------------------------------------------------------------------ */

// A crafting system as Fabricate exposes it: components carry an id + the
// sourceItemUuid an owned item is matched against.
const SYSTEMS = [
  {
    components: [
      { id: "fab.iron-ore", sourceItemUuid: "Compendium.world.items.iron" },
      { id: "fab.iron-ingot", sourceItemUuid: "Compendium.world.items.ingot" },
    ],
  },
];

test("buildComponentSourceIndex maps sourceItemUuid → componentId across systems", () => {
  const idx = buildComponentSourceIndex(SYSTEMS);
  assert.equal(idx.get("Compendium.world.items.iron"), "fab.iron-ore");
  assert.equal(idx.get("Compendium.world.items.ingot"), "fab.iron-ingot");
  assert.equal(idx.size, 2);
});

test("buildComponentSourceIndex skips components missing id or sourceItemUuid", () => {
  const idx = buildComponentSourceIndex([
    { components: [{ id: "a" }, { sourceItemUuid: "x" }, { id: "b", sourceItemUuid: "y" }] },
  ]);
  assert.deepEqual([...idx.entries()], [["y", "b"]]);
});

test("matchComponentId resolves via each of Fabricate's three source fields", () => {
  const idx = buildComponentSourceIndex(SYSTEMS);
  // direct uuid
  assert.equal(matchComponentId({ uuid: "Compendium.world.items.iron" }, idx), "fab.iron-ore");
  // _stats.compendiumSource
  assert.equal(
    matchComponentId({ _stats: { compendiumSource: "Compendium.world.items.ingot" } }, idx),
    "fab.iron-ingot"
  );
  // legacy flags.core.sourceId
  assert.equal(
    matchComponentId({ flags: { core: { sourceId: "Compendium.world.items.iron" } } }, idx),
    "fab.iron-ore"
  );
});

test("matchComponentId returns null for an unmanaged item or empty index", () => {
  const idx = buildComponentSourceIndex(SYSTEMS);
  assert.equal(matchComponentId({ uuid: "Actor.x.Item.y" }, idx), null);
  assert.equal(matchComponentId({ uuid: "Compendium.world.items.iron" }, new Map()), null);
});

test("itemQuantity reads dnd5e scalar, pf2e nested value, and defaults to 1", () => {
  assert.equal(itemQuantity({ system: { quantity: 5 } }), 5); // dnd5e
  assert.equal(itemQuantity({ system: { quantity: { value: 3 } } }), 3); // pf2e
  assert.equal(itemQuantity({ system: {} }), 1); // present but uncounted
  assert.equal(itemQuantity({ system: { quantity: -2 } }), 0); // clamped
});

test("scanComponentInventory folds an actor's items into componentId totals", () => {
  const items = [
    { uuid: "Compendium.world.items.iron", system: { quantity: 4 } },
    { _stats: { compendiumSource: "Compendium.world.items.iron" }, system: { quantity: 2 } }, // same component, summed
    { flags: { core: { sourceId: "Compendium.world.items.ingot" } }, system: { quantity: { value: 1 } } },
    { uuid: "Actor.x.Item.sword" }, // not a component → ignored
  ];
  const inv = scanComponentInventory(SYSTEMS, items);
  assert.equal(inv["fab.iron-ore"], 6); // 4 + 2
  assert.equal(inv["fab.iron-ingot"], 1);
  assert.equal(Object.keys(inv).length, 2);
});

test("scanComponentInventory is empty when no systems define components", () => {
  const items = [{ uuid: "Compendium.world.items.iron", system: { quantity: 4 } }];
  assert.deepEqual(scanComponentInventory([], items), {});
  assert.deepEqual(scanComponentInventory(SYSTEMS, []), {});
});

test("scanComponentInventory output feeds projectInventory end-to-end", () => {
  const map = createComponentMap([
    { componentId: "fab.iron-ore", resourceKey: "ore" },
    { componentId: "fab.iron-ingot", resourceKey: "ingot" },
  ]);
  const inv = scanComponentInventory(SYSTEMS, [
    { uuid: "Compendium.world.items.iron", system: { quantity: 4 } },
    { uuid: "Compendium.world.items.ingot", system: { quantity: 2 } },
  ]);
  const projection = projectInventory(inv, map);
  assert.equal(projection.ore, 4);
  assert.equal(projection.ingot, 2);
});

/* ------------------------------------------------------------------ */
/* fabricate-rules                                                     */
/* ------------------------------------------------------------------ */

test("makeFabricateRule defaults kind from op and empties numeric flows", () => {
  const harvest = makeFabricateRule({
    id: "iron-node",
    intervalSeconds: SECONDS.day,
    fabricate: { op: FAB_OP.HARVEST, environmentId: "env.river", taskId: "task.fish" },
  });
  assert.equal(harvest.kind, "producer");
  assert.deepEqual(harvest.inputs, {});
  assert.deepEqual(harvest.outputs, {});
  assert.ok(isFabricateRule(harvest));

  const craft = makeFabricateRule({
    id: "smelt",
    intervalSeconds: SECONDS.hour,
    fabricate: { op: FAB_OP.CRAFT, recipeId: "recipe.ingot", ingredients: { ore: 2 } },
  });
  assert.equal(craft.kind, "converter");
});

test("makeFabricateRule rejects a rule without a valid op", () => {
  assert.throws(() => makeFabricateRule({ id: "x", intervalSeconds: 1, fabricate: { op: "nope" } }));
});

test("a Fabricate rule fires intervals in the pure plan without moving the ledger", () => {
  const rule = makeFabricateRule({
    id: "iron-node",
    intervalSeconds: SECONDS.day,
    fabricate: { op: FAB_OP.HARVEST, environmentId: "env.river", taskId: "task.fish" },
  });
  const { deltas, applications } = computeTickPlan({ ore: 0 }, { counts: {} }, [rule], 0, 3 * SECONDS.day);
  assert.deepEqual(deltas, {}, "no numeric delta — the effect is Fabricate's");
  const app = applications.find((a) => a.ruleId === "iron-node");
  assert.equal(app.intervals, 3); // three daily harvests counted
  assert.equal(app.units, 1);
});

test("planFabricateOps turns harvest applications into ops by units x intervals", () => {
  const rule = makeFabricateRule({
    id: "iron-node",
    intervalSeconds: SECONDS.day,
    assetUnits: 2, // two nodes
    fabricate: { op: FAB_OP.HARVEST, environmentId: "env.river", taskId: "task.fish" },
  });
  const { applications } = computeTickPlan({}, { counts: {} }, [rule], 0, 3 * SECONDS.day);
  const ops = planFabricateOps(applications, [rule], {});
  assert.equal(ops.length, 1);
  assert.equal(ops[0].op, FAB_OP.HARVEST);
  assert.equal(ops[0].environmentId, "env.river");
  assert.equal(ops[0].taskId, "task.fish");
  assert.equal(ops[0].times, 6); // 2 units x 3 intervals
});

test("planFabricateOps caps a craft by the scarcest ingredient on hand", () => {
  const rule = makeFabricateRule({
    id: "smelt",
    intervalSeconds: SECONDS.hour,
    fabricate: { op: FAB_OP.CRAFT, recipeId: "recipe.ingot", ingredients: { ore: 2 } },
  });
  // 5 hours would want 5 crafts, but only 6 ore (=3 crafts worth) on hand.
  const { applications } = computeTickPlan({ ore: 6 }, { counts: {} }, [rule], 0, 5 * SECONDS.hour);
  const ops = planFabricateOps(applications, [rule], { ore: 6 });
  assert.equal(ops[0].times, 3); // floor(6 / 2)
  assert.equal(ops[0].recipeId, "recipe.ingot");
});

test("planFabricateOps drops a craft with no affordable ingredients", () => {
  const rule = makeFabricateRule({
    id: "smelt",
    intervalSeconds: SECONDS.hour,
    fabricate: { op: FAB_OP.CRAFT, recipeId: "recipe.ingot", ingredients: { ore: 2 } },
  });
  const { applications } = computeTickPlan({ ore: 1 }, { counts: {} }, [rule], 0, 5 * SECONDS.hour);
  const ops = planFabricateOps(applications, [rule], { ore: 1 });
  assert.equal(ops.length, 0); // floor(1/2) = 0 → no op
});

test("planFabricateOps ignores plain numeric rules", () => {
  const numeric = { id: "drill", kind: "producer", binding: "asset", assetUnits: 1, intervalSeconds: 1, inputs: {}, outputs: { ore: 1 } };
  const { applications } = computeTickPlan({}, { counts: {} }, [numeric], 0, 10);
  assert.deepEqual(planFabricateOps(applications, [numeric], {}), []);
});

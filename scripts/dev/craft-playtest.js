/**
 * Rung 1 playtest harness — a runnable, self-contained ore→ingot craft scenario
 * for exercising the crafting loop by hand (dev/playtest only; exposed at `api.dev`).
 *
 * `setupCraftPlaytest()` builds everything from scratch: two source items, a simple
 * Fabricate crafting system (2 ore → 1 ingot), a fresh Keep stocked with ore, the
 * component→resource map, and a CRAFT economy rule bound on the tick. Then either:
 *   - **manual:** craft via Fabricate's UI / `game.fabricate.craft(keep, recipeId)`, or
 *   - **tick-driven:** advance world time (Time Controls) → the rule auto-crafts.
 * Watch the result in the Keep panel (`api.keeps.open`) / stockpile.
 *
 * `teardownCraftPlaytest()` removes everything it created (items, system, recipe,
 * Keep, rule, component map). Everything it creates is tagged with the
 * `flags["automate-fvtt"].playtest` marker so teardown is reliable.
 *
 * NOTE: Fabricate-crafted output is recognized by **name** (it carries no source
 * ref), so the components use distinct, stable names. See `component-map.js`.
 * @module dev/craft-playtest
 */

import { MODULE_ID } from "../constants.js";
import { log } from "../logger.js";

const SID = "automate-fvtt-craft-playtest";
const RECIPE_ID = `${SID}-smelt`;
const RULE_ID = `${MODULE_ID}.playtest.smelt`;
const ORE = { id: "ore", name: "Playtest Ore" };
const INGOT = { id: "ingot", name: "Playtest Ingot" };
const MARK = { [MODULE_ID]: { playtest: true } };

/** Pick a physical item type that carries a quantity in the active system. */
function physicalItemType() {
  const types = (game.documentTypes?.Item ?? []).filter((t) => t !== "base");
  return ["equipment", "treasure", "consumable", "loot"].find((t) => types.includes(t)) ?? types[0];
}

/**
 * Build the ore→ingot playtest scenario. Idempotent: tears down a prior run first.
 * @param {object} [opts]
 * @param {number} [opts.ore=20] starting ore stocked on the Keep
 * @param {number} [opts.intervalSeconds=3600] craft cadence for the tick-driven rule
 * @returns {Promise<{keepId: string, recipeId: string, system: string}>}
 */
export async function setupCraftPlaytest({ ore = 20, intervalSeconds = 3600 } = {}) {
  const api = game.modules.get(MODULE_ID)?.api;
  const fab = game.fabricate;
  if (!api?.rules || !fab) throw new Error("[automate-fvtt] playtest: automate-fvtt API or Fabricate unavailable.");
  await teardownCraftPlaytest(); // clean slate

  const csm = fab.getCraftingSystemManager();
  const rm = fab.getRecipeManager();
  const { Recipe } = fab.api;
  const itemType = physicalItemType();

  // Source items the components are backed by (distinct names — output matches by name).
  const oreSrc = await Item.create({ name: ORE.name, type: itemType, system: { quantity: 1 }, flags: MARK });
  const ingotSrc = await Item.create({ name: INGOT.name, type: itemType, system: { quantity: 1 }, flags: MARK });

  // Crafting system: simple mode, check disabled (deterministic).
  const sys = await csm.createSystem({ id: SID, name: "Craft Playtest", resolutionMode: "simple" });
  const cOre = await csm.createItem(sys.id, { id: ORE.id, name: ORE.name, sourceItemUuid: oreSrc.uuid });
  const cIngot = await csm.createItem(sys.id, { id: INGOT.id, name: INGOT.name, sourceItemUuid: ingotSrc.uuid });
  const recipe = new Recipe({
    id: RECIPE_ID, name: "Smelt Playtest Ingot", craftingSystemId: sys.id,
    ingredientSets: [{ id: "s", ingredientGroups: [{ id: "g", options: [{ match: { type: "component", componentId: cOre.id }, quantity: 2 }] }] }],
    resultGroups: [{ id: "rg", name: "Default", results: [{ componentId: cIngot.id, quantity: 1 }] }],
  });
  await rm.createRecipe(recipe.toJSON());

  // A fresh Keep stocked with real ore (referencing the ore component's source).
  const keep = await api.keeps.create({ name: "Playtest Keep" });
  await keep.setFlag(MODULE_ID, "playtest", true);
  await keep.createEmbeddedDocuments("Item", [
    { name: ORE.name, type: itemType, system: { quantity: ore }, flags: { core: { sourceId: oreSrc.uuid } } },
  ]);

  // Map components → stockpile resources, register the craft rule, and seed the
  // numeric ore so the first tick can cap the craft correctly (projection then
  // keeps both resources in sync with the real items).
  api.rules.setComponentMap([
    { componentId: ORE.id, resourceKey: "ore" },
    { componentId: INGOT.id, resourceKey: "ingot" },
  ]);
  api.rules.register(api.rules.makeFabricateRule({
    id: RULE_ID,
    intervalSeconds,
    fabricate: { op: api.rules.FAB_OP.CRAFT, recipeId: RECIPE_ID, ingredients: { ore: 2 } },
  }));
  await api.keeps.setResource(keep, "ore", ore);

  log.info(
    `playtest ready — Keep "${keep.name}" (${keep.id}) has ${ore} ore. ` +
      `Open it with api.keeps.open(), then advance time (or game.fabricate.craft) to smelt ingots.`
  );
  return { keepId: keep.id, recipeId: RECIPE_ID, system: SID };
}

/**
 * Remove everything the playtest created. Safe to call when nothing exists.
 * @returns {Promise<void>}
 */
export async function teardownCraftPlaytest() {
  const api = game.modules.get(MODULE_ID)?.api;
  const fab = game.fabricate;
  try {
    api?.rules?.unregister?.(RULE_ID);
    api?.rules?.setComponentMap?.([]);
  } catch (err) { log.warn(`playtest teardown (rules): ${err?.message ?? err}`); }

  // Delete flagged Keeps + source items.
  for (const actor of game.actors?.filter((a) => a.getFlag?.(MODULE_ID, "playtest")) ?? []) {
    try { await actor.delete(); } catch (err) { log.warn(`playtest teardown (keep): ${err?.message ?? err}`); }
  }
  for (const item of game.items?.filter((i) => i.getFlag?.(MODULE_ID, "playtest")) ?? []) {
    try { await item.delete(); } catch (err) { log.warn(`playtest teardown (item): ${err?.message ?? err}`); }
  }

  // Delete the crafting system + its recipes.
  try {
    const csm = fab?.getCraftingSystemManager?.();
    const rm = fab?.getRecipeManager?.();
    if (csm?.getSystem?.(SID)) {
      for (const r of rm?.getRecipes?.({ craftingSystemId: SID }) ?? []) await fab.deleteRecipe(r.id);
      await csm.deleteSystem?.(SID);
    }
  } catch (err) { log.warn(`playtest teardown (system): ${err?.message ?? err}`); }
}

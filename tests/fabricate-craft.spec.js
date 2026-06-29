// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Rung 1 — end-to-end crafting loop against a live world: build a real-item-backed
 * Fabricate system, give a Keep ingredients, run `craft()`, and confirm OUR adapter
 * projects the crafted output into the Keep inventory.
 *
 * This pins the key finding behind Rung 1: Fabricate's `craft()` produces real items
 * but stamps them with NO source reference, so they are recognized only by NAME
 * (mirrored by `component-map.js`). Without the name-matching fallback, the crafted
 * result would not project — this test guards that.
 *
 * SKIPS gracefully without a licensed Foundry / GM seat. To run: log out to the join
 * screen, then `npx playwright test fabricate-craft`.
 */

const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_USER = process.env.FOUNDRY_USER || 'Gamemaster';

test.describe.configure({ mode: 'serial' });

/** Join the active world as the GM and wait for `game.ready`. @returns {Promise<string|null>} */
async function joinAsGM(page) {
  try {
    await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: 'domcontentloaded', timeout: 8000 });
  } catch {
    return `Foundry not reachable at ${FOUNDRY_URL} — start it with a world active.`;
  }
  const select = page.locator('select[name="userid"]');
  try {
    await select.waitFor({ state: 'attached', timeout: 10000 });
  } catch {
    return 'No join screen (Foundry is likely on Setup) — launch a world first.';
  }
  const options = await select.locator('option').evaluateAll((els) =>
    els.map((o) => ({ value: o.value, text: o.textContent?.trim() ?? '', disabled: o.disabled })).filter((o) => o.value)
  );
  const gm = options.find((o) => new RegExp(FOUNDRY_USER, 'i').test(o.text)) ?? options[0];
  if (!gm) return 'No selectable users on the join screen.';
  if (gm.disabled) return `The "${gm.text}" seat is occupied — log out of the world so the test can take it.`;
  await select.selectOption(gm.value);
  await page.click('button[name="join"], button[type="submit"]');
  try {
    await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 45000 });
  } catch {
    return 'World did not reach the ready state within 45s.';
  }
  return null;
}

test.describe('Rung 1 — crafting loop projects into the Keep', () => {
  test('craft consumes ingredients and the crafted output is recognized', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');

    const ready = await page.evaluate(() => ({
      fabricate: globalThis.game?.modules?.get('fabricate')?.active === true,
      api: !!globalThis.game?.modules?.get('automate-fvtt')?.api?.fabricate,
    }));
    test.skip(!ready.fabricate, 'fabricate is not active in this world.');
    test.skip(!ready.api, 'automate-fvtt adapter API unavailable.');

    const result = await page.evaluate(async () => {
      const fab = globalThis.game.fabricate;
      const afv = globalThis.game.modules.get('automate-fvtt').api;
      const csm = fab.getCraftingSystemManager();
      const rm = fab.getRecipeManager();
      const { Recipe } = fab.api;
      const SID = 'automate-fvtt-rung1-craft-test';
      const created = [];
      let keep = null;
      try {
        const prior = csm.getSystem(SID);
        if (prior) { for (const r of rm.getRecipes({ craftingSystemId: SID })) await fab.deleteRecipe(r.id); await csm.deleteSystem?.(SID); }

        const itemTypes = globalThis.game.documentTypes.Item.filter((t) => t !== 'base');
        const itemType = ['equipment', 'treasure', 'consumable', 'loot'].find((t) => itemTypes.includes(t)) ?? itemTypes[0];

        const oreSrc = await globalThis.Item.create({ name: 'Rung1 Test Ore', type: itemType, system: { quantity: 1 } });
        const ingotSrc = await globalThis.Item.create({ name: 'Rung1 Test Ingot', type: itemType, system: { quantity: 1 } });
        created.push(oreSrc, ingotSrc);

        const sys = await csm.createSystem({ id: SID, name: 'Rung1 Craft Test', resolutionMode: 'simple' });
        const cOre = await csm.createItem(sys.id, { id: 'ore', name: 'Rung1 Test Ore', sourceItemUuid: oreSrc.uuid });
        const cIngot = await csm.createItem(sys.id, { id: 'ingot', name: 'Rung1 Test Ingot', sourceItemUuid: ingotSrc.uuid });
        const recipe = new Recipe({
          id: 'smelt', name: 'Smelt', craftingSystemId: sys.id,
          ingredientSets: [{ id: 's', ingredientGroups: [{ id: 'g', options: [{ match: { type: 'component', componentId: cOre.id }, quantity: 2 }] }] }],
          resultGroups: [{ id: 'rg', name: 'Default', results: [{ componentId: cIngot.id, quantity: 1 }] }],
        });
        await rm.createRecipe(recipe.toJSON());

        // Create a real Keep via our API (flag-backed) and give it 4 ore.
        keep = await afv.keeps.create({ name: 'Rung1 Craft Keep' });
        await keep.createEmbeddedDocuments('Item', [
          { name: 'Rung1 Test Ore', type: itemType, system: { quantity: 4 }, flags: { core: { sourceId: oreSrc.uuid } } },
        ]);

        const invBefore = afv.fabricate.readInventory(keep);
        const craft = await fab.craft(keep, 'smelt', {});
        const invAfter = afv.fabricate.readInventory(keep);

        return {
          craftSuccess: craft?.success === true,
          invBefore, invAfter,
        };
      } finally {
        try { if (keep) await keep.delete(); } catch {}
        try { const s = csm.getSystem(SID); if (s) { for (const r of rm.getRecipes({ craftingSystemId: SID })) await fab.deleteRecipe(r.id); await csm.deleteSystem?.(SID); } } catch {}
        for (const d of created) { try { await d.delete(); } catch {} }
      }
    });

    console.log('[fabricate-craft] result:', JSON.stringify(result, null, 2));

    expect(result.craftSuccess, 'craft() reports success').toBe(true);
    expect(result.invBefore.ore, 'Keep starts with 4 ore').toBe(4);
    // Ingredients consumed (2 ore) and the crafted ingot is recognized by the projection.
    expect(result.invAfter.ore, 'ore reduced by the recipe cost').toBe(2);
    expect(result.invAfter.ingot, 'crafted ingot projects into the Keep inventory').toBe(1);
  });
});

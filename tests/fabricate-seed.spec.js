// @ts-check
import { test, expect } from '@playwright/test';

/**
 * End-to-end verification of the Keep-economy seed + the stockpile↔component
 * bridge, driven against a live Foundry world through OUR module's public API
 * (`game.modules.get('automate-fvtt').api.fabricate`):
 *
 *   1. seedSystem() imports data/fabricate/keep-economy.json into Fabricate.
 *   2. The seeded system exposes components with id + sourceItemUuid (the fields
 *      the inventory matcher keys on — completes the surface contract's deferred
 *      component-shape check).
 *   3. readInventory() matches a Keep's owned Items to components by source
 *      reference (the no-getInventory item scan) and returns componentId → qty.
 *
 * SKIPS gracefully when it can't reach a ready world / take the GM seat / find
 * both modules active, so CI stays green. To run for real: launch the world,
 * log OUT to the join screen, then `npx playwright test fabricate-seed`.
 */

const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_USER = process.env.FOUNDRY_USER || 'Gamemaster';
const SYSTEM_ID = 'automate-fvtt-keep-economy';
const ORE_COMPONENT_ID = 'iron-ore';

test.describe.configure({ mode: 'serial' });

/** Join the active world as the GM and wait for `game.ready`. @returns {Promise<string|null>} skip reason or null. */
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

test.describe('Automate FVTT — Keep economy seed + inventory bridge', () => {
  test('seeds the system and matches a Keep inventory through the adapter', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');

    const ready = await page.evaluate(() => ({
      fabricate: globalThis.game?.modules?.get('fabricate')?.active === true,
      automate: globalThis.game?.modules?.get('automate-fvtt')?.active === true,
      hasApi: !!globalThis.game?.modules?.get('automate-fvtt')?.api?.fabricate,
    }));
    test.skip(!ready.fabricate, 'fabricate is not active in this world.');
    test.skip(!ready.automate, 'automate-fvtt is not active in this world.');
    test.skip(!ready.hasApi, 'automate-fvtt API (adapter) is unavailable.');

    // 1) Seed the shipped system through our adapter (idempotent; force refresh).
    const seed = await page.evaluate(async (url) => {
      const api = globalThis.game.modules.get('automate-fvtt').api.fabricate;
      const result = await api.seedSystem(url, { overwriteExisting: true });
      const sys = api.getSystem('automate-fvtt-keep-economy');
      return {
        result,
        present: !!sys,
        components: (sys?.components ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          keys: Object.keys(c),
          sourceItemUuid: c.sourceItemUuid,
        })),
      };
    }, 'modules/automate-fvtt/data/fabricate/keep-economy.json');

    console.log('[fabricate-seed] seed:', JSON.stringify(seed, null, 2));
    expect(seed.present, 'seeded system should exist').toBe(true);

    // 2) The ore component carries the fields the matcher keys on.
    const ore = seed.components.find((c) => c.id === ORE_COMPONENT_ID);
    expect(ore, 'iron-ore component present').toBeTruthy();
    expect(ore.keys, 'component carries id').toContain('id');
    expect(ore.keys, 'component carries sourceItemUuid').toContain('sourceItemUuid');
    expect(ore.sourceItemUuid, 'ore sourceItemUuid').toBe('automate-fvtt.seed.iron-ore');

    // 3) Create a Keep through OUR API (core type + module flag — the path that
    //    must work in pf2e), give it Items matching the ore component by source
    //    ref, then read the inventory back through the adapter's item-scan.
    const probe = await page.evaluate(async ({ systemId, oreId }) => {
      const mod = globalThis.game.modules.get('automate-fvtt').api;
      const api = mod.fabricate;
      const keeps = mod.keeps;
      const sys = api.getSystem(systemId);
      const src = sys.components.find((c) => c.id === oreId).sourceItemUuid;

      // Pick a physical item type that carries a quantity in this game system.
      const types = globalThis.game.documentTypes.Item.filter((t) => t !== 'base');
      const physical = ['equipment', 'consumable', 'treasure', 'loot', 'weapon', 'armor', 'backpack'];
      const itemType = physical.find((t) => types.includes(t)) ?? types[0];

      // Create via the public Keep API — verifies createKeep works under pf2e.
      const keep = await keeps.create({ name: 'Seed Probe Keep' });
      try {
        const created = { id: keep.id, actorType: keep.type, isKeep: keeps.isKeep(keep) };

        // Two stacks of ore via the legacy source ref → must match the SAME component and sum.
        await keep.createEmbeddedDocuments('Item', [
          { name: 'Iron Ore', type: itemType, system: { quantity: 3 }, flags: { core: { sourceId: src } } },
          { name: 'Iron Ore', type: itemType, system: { quantity: 2 }, flags: { core: { sourceId: src } } },
          { name: 'Unrelated', type: itemType, system: { quantity: 9 } }, // no source ref → ignored
        ]);
        const inventory = api.readInventory(keep);
        const qtyOf = (it) => {
          const q = it.system?.quantity;
          const n = q != null && typeof q === 'object' ? q.value : q;
          return Math.max(0, Number(n ?? 1) || 0);
        };
        const oreItems = keep.items.filter((it) => it.flags?.core?.sourceId === src);
        const expectedOre = oreItems.reduce((s, it) => s + qtyOf(it), 0);

        // Verify the flag-backed ledger write path too (works under pf2e).
        await keeps.setResource(keep, 'sp', 10);
        const sp = keeps.getData(keep).stockpile?.sp ?? null;

        return { created, itemType, oreSrc: src, inventory, expectedOre, sp, itemCount: keep.items.size };
      } finally {
        await keep.delete(); // clean up the throwaway actor
      }
    }, { systemId: SYSTEM_ID, oreId: ORE_COMPONENT_ID });

    console.log('[fabricate-seed] keep + inventory probe:', JSON.stringify(probe, null, 2));

    // createKeep produced a real, flag-identified Keep on a CORE actor type.
    expect(probe.created.isKeep, 'created actor is recognized as a Keep').toBe(true);
    expect(probe.created.actorType, 'Keep uses a core actor type, not a module subtype').not.toContain('.');
    // The flag-backed ledger write persisted.
    expect(probe.sp, 'setResource wrote to the Keep flag ledger').toBe(10);
    // The matcher folds both ore stacks into the ore component and ignores the rest.
    expect(probe.inventory[ORE_COMPONENT_ID], 'ore folded by component id').toBe(probe.expectedOre);
    expect(Object.keys(probe.inventory), 'only the matched component appears').toEqual([ORE_COMPONENT_ID]);
  });
});

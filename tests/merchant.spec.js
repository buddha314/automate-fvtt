// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Merchant system (live) — CRUD on a Keep + weighted restock fill the shop to
 * capacity. (Buy/sell currency movement is not built yet — pending the output-economy
 * currency plumbing.)
 *
 * SKIPS gracefully without a licensed Foundry / GM seat.
 */

const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_USER = process.env.FOUNDRY_USER || 'Gamemaster';

test.describe.configure({ mode: 'serial' });

async function joinAsGM(page) {
  try { await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: 'domcontentloaded', timeout: 8000 }); }
  catch { return `Foundry not reachable at ${FOUNDRY_URL}.`; }
  const select = page.locator('select[name="userid"]');
  try { await select.waitFor({ state: 'attached', timeout: 10000 }); } catch { return 'No join screen.'; }
  const options = await select.locator('option').evaluateAll((els) =>
    els.map((o) => ({ value: o.value, text: o.textContent?.trim() ?? '', disabled: o.disabled })).filter((o) => o.value)
  );
  const gm = options.find((o) => new RegExp(FOUNDRY_USER, 'i').test(o.text)) ?? options[0];
  if (!gm) return 'No selectable users.';
  if (gm.disabled) return `The "${gm.text}" seat is occupied — log out of the world.`;
  await select.selectOption(gm.value);
  await page.click('button[name="join"], button[type="submit"]');
  try { await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 45000 }); }
  catch { return 'World did not reach ready in 45s.'; }
  return null;
}

test.describe('Merchants — CRUD + restock', () => {
  test('add a merchant, restock to capacity, remove it', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');

    const ready = await page.evaluate(() => !!globalThis.game?.modules?.get('automate-fvtt')?.api?.merchants);
    test.skip(!ready, 'automate-fvtt api.merchants unavailable.');

    const result = await page.evaluate(async () => {
      const api = globalThis.game.modules.get('automate-fvtt').api;
      let keep = null;
      try {
        keep = await api.keeps.create({ name: 'Merchant Test Keep' });
        const m = await api.merchants.add(keep, {
          type: 'smith', name: 'Test Smith', capacity: 6,
          restock: {
            weighting: 'inverseValue',
            candidates: [
              { itemUuid: 'Item.cheap', baseValue: 1 },
              { itemUuid: 'Item.mid', baseValue: 5 },
              { itemUuid: 'Item.rare', baseValue: 20 },
            ],
          },
        });
        const afterAdd = api.merchants.list(keep).length;
        const stockBefore = (api.merchants.get(keep, m.id).stock ?? []).length;

        await api.merchants.restock(keep, m.id, { worldTime: 1000 });
        const m2 = api.merchants.get(keep, m.id);
        const totalQty = (m2.stock ?? []).reduce((a, s) => a + s.quantity, 0);
        const validPrices = (m2.stock ?? []).every((s) => [1, 5, 20].includes(s.price));

        await api.merchants.remove(keep, m.id);
        const afterRemove = api.merchants.list(keep).length;

        return {
          afterAdd, stockBefore, totalQty, validPrices,
          lastRestockAt: m2.restock?.lastRestockAt, afterRemove,
        };
      } finally {
        try { if (keep) await keep.delete(); } catch {}
      }
    });

    console.log('[merchant] result:', JSON.stringify(result));

    expect(result.afterAdd, 'merchant added to the Keep').toBe(1);
    expect(result.stockBefore, 'starts unstocked').toBe(0);
    expect(result.totalQty, 'restock fills exactly to capacity').toBe(6);
    expect(result.validPrices, 'stock prices come from candidate values').toBe(true);
    expect(result.lastRestockAt, 'restock stamps the world time').toBe(1000);
    expect(result.afterRemove, 'merchant removed').toBe(0);
  });
});

// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Output pipeline (#46), live — storage caps clamp the stockpile each tick and the
 * overflow is routed by policy: lost | buffered | auto-sold (→ merchant → treasury).
 * Uses a unique resource key (`pt_widget`) so it can't affect any real Keeps.
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

test.describe('Output pipeline — caps + overflow policies', () => {
  test('lost clamps; buffered holds; auto-sold pays the treasury', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');
    const ready = await page.evaluate(() => !!globalThis.game?.modules?.get('automate-fvtt')?.api?.rules?.setCapacities);
    test.skip(!ready, 'output pipeline API unavailable.');

    const r = await page.evaluate(async () => {
      const api = globalThis.game.modules.get('automate-fvtt').api;
      const RES = 'pt_widget';
      let keep = null;
      const tick = async () => { const t = globalThis.game.time.worldTime; await api.rules.applyTick({ prevTime: t, worldTime: t + 1 }); };
      const sp = (k) => api.keeps.getData(k).stockpile?.[RES] ?? 0;
      try {
        keep = await api.keeps.create({ name: 'Output Pipeline Keep' });
        api.rules.setCapacities({ [RES]: 20 });

        // lost
        await api.keeps.setResource(keep, RES, 50);
        api.rules.setOverflowPolicy('lost');
        await tick();
        const lost = sp(keep);

        // buffered
        await api.keeps.setResource(keep, RES, 50);
        api.rules.setOverflowPolicy('buffered');
        await tick();
        const bufStock = sp(keep);
        const buffered = api.keeps.getData(keep).buffers?.overflow?.[RES] ?? 0;

        // auto-sold (a merchant that buys the resource at 2)
        await api.merchants.add(keep, { type: 'trader', buys: [{ resourceKey: RES, price: 2 }] });
        await api.keeps.setResource(keep, RES, 50);
        api.rules.setOverflowPolicy('auto-sold');
        const treasury0 = api.keeps.getTreasury(keep);
        await tick();
        const soldStock = sp(keep);
        const treasury1 = api.keeps.getTreasury(keep);

        return { lost, bufStock, buffered, soldStock, treasury0, treasury1 };
      } finally {
        try { api.rules.setCapacities({}); api.rules.setOverflowPolicy('lost'); } catch {}
        try { if (keep) await keep.delete(); } catch {}
      }
    });

    console.log('[output-pipeline]', JSON.stringify(r));
    // lost
    expect(r.lost, 'lost clamps to cap').toBe(20);
    // buffered
    expect(r.bufStock, 'buffered clamps stockpile to cap').toBe(20);
    expect(r.buffered, 'buffered holds the 30 overflow').toBe(30);
    // auto-sold
    expect(r.soldStock, 'auto-sold clamps to cap').toBe(20);
    expect(r.treasury1 - r.treasury0, 'auto-sold pays 30 × 2 into the treasury').toBe(60);
  });
});

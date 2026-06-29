// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Rung 1 — the playtest harness end-to-end: `api.dev.setupCraftPlaytest()` builds an
 * ore→ingot scenario, a tick-driven craft converts ore to ingots, the stockpile
 * projection reflects it, and `teardownCraftPlaytest()` cleans up.
 *
 * SKIPS gracefully without a licensed Foundry / GM seat.
 */

const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_USER = process.env.FOUNDRY_USER || 'Gamemaster';

test.describe.configure({ mode: 'serial' });

async function joinAsGM(page) {
  try {
    await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: 'domcontentloaded', timeout: 8000 });
  } catch {
    return `Foundry not reachable at ${FOUNDRY_URL}.`;
  }
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

test.describe('Rung 1 — craft playtest harness', () => {
  test('setup → tick-driven craft → stockpile updates → teardown', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');

    const ready = await page.evaluate(() => ({
      fabricate: globalThis.game?.modules?.get('fabricate')?.active === true,
      dev: !!globalThis.game?.modules?.get('automate-fvtt')?.api?.dev,
    }));
    test.skip(!ready.fabricate, 'fabricate is not active.');
    test.skip(!ready.dev, 'automate-fvtt api.dev unavailable.');

    const result = await page.evaluate(async () => {
      const api = globalThis.game.modules.get('automate-fvtt').api;
      try {
        const { keepId } = await api.dev.setupCraftPlaytest({ ore: 20, intervalSeconds: 3600 });
        const keep = globalThis.game.actors.get(keepId);
        const before = { ...(api.keeps.getData(keep).stockpile ?? {}) };

        // Deterministically run one tick spanning the craft interval.
        const t = globalThis.game.time.worldTime;
        await api.rules.applyTick({ prevTime: t, worldTime: t + 3600 });

        const after = { ...(api.keeps.getData(keep).stockpile ?? {}) };
        const readInv = api.fabricate.readInventory(keep);

        await api.dev.teardownCraftPlaytest();
        return {
          before, after, readInv,
          keepGone: !globalThis.game.actors.get(keepId),
          systemGone: !api.fabricate.getSystem('automate-fvtt-craft-playtest'),
        };
      } finally {
        // Belt-and-suspenders cleanup if an assertion path left anything.
        try { await api.dev.teardownCraftPlaytest(); } catch {}
      }
    });

    console.log('[fabricate-playtest] result:', JSON.stringify(result, null, 2));

    expect(result.before.ore, 'Keep starts with 20 ore').toBe(20);
    expect(result.after.ingot ?? 0, 'tick-driven craft produced ingots').toBeGreaterThanOrEqual(1);
    expect(result.after.ore, 'ore consumed by crafting').toBeLessThan(result.before.ore);
    expect(result.keepGone, 'teardown removed the Keep').toBe(true);
    expect(result.systemGone, 'teardown removed the crafting system').toBe(true);
  });
});

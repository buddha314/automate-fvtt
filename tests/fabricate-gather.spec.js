// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Rung 2 — the gathering harness end-to-end: `api.dev.setupGatheringPlaytest()` builds
 * a Keep that harvests from a Fabricate environment+task (no canvas), a tick-driven
 * HARVEST yields the resource, and the stockpile projection reflects it.
 *
 * Note: Fabricate blocks gathering while the game is paused (`GAME_PAUSED`), so the
 * test unpauses around the tick and restores the prior pause state.
 *
 * SKIPS gracefully without a licensed Foundry / GM seat.
 */

const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_USER = process.env.FOUNDRY_USER || 'Gamemaster';

test.describe.configure({ mode: 'serial' });

async function joinAsGM(page) {
  try {
    await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: 'domcontentloaded', timeout: 8000 });
  } catch { return `Foundry not reachable at ${FOUNDRY_URL}.`; }
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

test.describe('Rung 2 — gathering harness', () => {
  test('setup → tick-driven harvest (unpaused) → stockpile updates → teardown', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');

    const ready = await page.evaluate(() => ({
      fabricate: globalThis.game?.modules?.get('fabricate')?.active === true,
      dev: !!globalThis.game?.modules?.get('automate-fvtt')?.api?.dev?.setupGatheringPlaytest,
    }));
    test.skip(!ready.fabricate, 'fabricate is not active.');
    test.skip(!ready.dev, 'automate-fvtt gathering playtest helpers unavailable.');

    const result = await page.evaluate(async () => {
      const api = globalThis.game.modules.get('automate-fvtt').api;
      const SID = 'automate-fvtt-gather-playtest';
      let wasPaused = globalThis.game.paused;
      try {
        const { keepId } = await api.dev.setupGatheringPlaytest({ intervalSeconds: 86400 });
        const keep = globalThis.game.actors.get(keepId);
        const before = { ...(api.keeps.getData(keep).stockpile ?? {}) };

        // Gathering is blocked while paused — unpause, run a one-day tick, restore.
        if (wasPaused) await globalThis.game.togglePause(false);
        const t = globalThis.game.time.worldTime;
        await api.rules.applyTick({ prevTime: t, worldTime: t + 86400 });
        if (wasPaused) { await globalThis.game.togglePause(true); wasPaused = false; }

        const after = { ...(api.keeps.getData(keep).stockpile ?? {}) };
        const readInv = api.fabricate.readInventory(keep);
        const envStore = globalThis.game.fabricate.getGatheringEnvironmentStore();

        await api.dev.teardownGatheringPlaytest();
        return {
          before, after, readInv,
          keepGone: !globalThis.game.actors.get(keepId),
          systemGone: !globalThis.game.fabricate.getCraftingSystemManager().getSystem(SID),
          envGone: (envStore.listBySystem?.(SID) ?? []).length === 0,
        };
      } finally {
        try { if (wasPaused) await globalThis.game.togglePause(true); } catch {}
        try { await api.dev.teardownGatheringPlaytest(); } catch {}
      }
    });

    console.log('[fabricate-gather] result:', JSON.stringify(result, null, 2));

    expect(result.after.berry ?? 0, 'tick-driven harvest produced berries').toBeGreaterThanOrEqual(1);
    expect(result.readInv.berry ?? 0, 'harvested item projected into the Keep inventory').toBeGreaterThanOrEqual(1);
    expect(result.keepGone, 'teardown removed the Keep').toBe(true);
    expect(result.systemGone, 'teardown removed the crafting system').toBe(true);
    expect(result.envGone, 'teardown removed the gathering environment').toBe(true);
  });
});

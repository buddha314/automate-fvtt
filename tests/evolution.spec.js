// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Keep evolution (live) — a metric change moves the tier, the tier publishes per-Keep
 * storage capacities, and the output pipeline clamps to them. Uses a unique resource
 * key (`pt_ore`) so it can't affect any real Keeps.
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

test.describe('Keep evolution — tier drives storage caps', () => {
  test('metric change → tier rises → caps published → output pipeline clamps', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');
    const ready = await page.evaluate(() => !!globalThis.game?.modules?.get('automate-fvtt')?.api?.evolution);
    test.skip(!ready, 'api.evolution unavailable.');

    const r = await page.evaluate(async () => {
      const api = globalThis.game.modules.get('automate-fvtt').api;
      let keep = null;
      try {
        api.evolution.configure({ capacityBase: { pt_ore: 10 } });
        keep = await api.keeps.create({ name: 'Evolution Keep' });

        const tier0 = api.evolution.getTier(keep);
        await api.evolution.setMetric(keep, 'population', 1000);
        const move = await api.evolution.setMetric(keep, 'area', 20); // → town (tier 2)
        const tier2 = api.evolution.getTier(keep);
        const caps = { ...(api.keeps.getData(keep).capacities ?? {}) };

        // The published caps must drive the output pipeline.
        await api.keeps.setResource(keep, 'pt_ore', 50);
        const t = globalThis.game.time.worldTime;
        await api.rules.applyTick({ prevTime: t, worldTime: t + 1 });
        const oreAfter = api.keeps.getData(keep).stockpile?.pt_ore ?? 0;

        return { tier0, tier2, caps, oreAfter, moveChanged: move.changed, movePrev: move.previous };
      } finally {
        try { api.evolution.configure({ capacityBase: {} }); } catch {}
        try { if (keep) await keep.delete(); } catch {}
      }
    });

    console.log('[evolution]', JSON.stringify(r));
    expect(r.tier0, 'starts at hamlet (tier 0)').toBe(0);
    expect(r.tier2, 'population 1000 + area 20 → town (tier 2)').toBe(2);
    expect(r.caps.pt_ore, 'tier 2 publishes cap 10×(2+1)=30').toBe(30);
    expect(r.oreAfter, 'output pipeline clamps pt_ore to the tier cap').toBe(30);
  });
});

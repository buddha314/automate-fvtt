// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Integration test: the Bandits on the River welcome splash, driven against a
 * live Foundry VTT instance.
 *
 * Foundry can't run in stock CI (it needs a licensed install + an active world),
 * so this test SKIPS gracefully when it can't reach a ready world or take the GM
 * seat — keeping CI green — and asserts the real UI when run locally against a
 * running world.
 *
 * To run it for real:
 *   1. Launch Foundry with a pf2e world that has bandits-on-the-river active.
 *   2. Make sure no one is logged in as the GM (Foundry locks a connected user's
 *      seat — log out to the join screen, keeping the world active).
 *   3. npx playwright test
 *
 * Config via env: FOUNDRY_URL (default http://localhost:30000),
 *                 FOUNDRY_USER (default Gamemaster).
 */

const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_USER = process.env.FOUNDRY_USER || 'Gamemaster';
const MODULE_ID = 'bandits-on-the-river';

// One GM seat → never run these in parallel.
test.describe.configure({ mode: 'serial' });

/**
 * Join the active world as the GM and wait for `game.ready`.
 * @returns {Promise<string|null>} a skip reason, or null on success.
 */
async function joinAsGM(page) {
  try {
    await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: 'domcontentloaded', timeout: 8000 });
  } catch {
    return `Foundry not reachable at ${FOUNDRY_URL} — start it with a world active.`;
  }

  // The join form is rendered client-side after load, so wait for the user
  // select to appear rather than reading the page too early.
  const select = page.locator('select[name="userid"]');
  try {
    await select.waitFor({ state: 'attached', timeout: 10000 });
  } catch {
    return 'No join screen (Foundry is likely on Setup) — launch a world first.';
  }

  const options = await select.locator('option').evaluateAll((els) =>
    els
      .map((o) => ({ value: o.value, text: o.textContent?.trim() ?? '', disabled: o.disabled }))
      .filter((o) => o.value)
  );
  const gm = options.find((o) => new RegExp(FOUNDRY_USER, 'i').test(o.text)) ?? options[0];
  if (!gm) return 'No selectable users on the join screen.';
  if (gm.disabled) {
    return `The "${gm.text}" seat is occupied — log out of the world so the test can take it.`;
  }

  await select.selectOption(gm.value);
  await page.click('button[name="join"], button[type="submit"]');
  try {
    await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 45000 });
  } catch {
    return 'World did not reach the ready state within 45s.';
  }
  return null;
}

test.describe('Bandits on the River — welcome splash', () => {
  test('renders for the GM and opens the native Adventure importer', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');

    const moduleActive = await page.evaluate(
      (id) => globalThis.game?.modules?.get(id)?.active === true,
      MODULE_ID
    );
    test.skip(!moduleActive, `${MODULE_ID} is not active in this world.`);

    // Deterministic: clear the "seen" flag and reload so the module's `ready`
    // hook shows a fresh splash regardless of prior runs.
    await page.evaluate((id) => globalThis.game.settings.set(id, 'splashSeen', false), MODULE_ID);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 45000 });

    // 1) The splash application renders.
    const splash = page.locator('#bandits-splash');
    await expect(splash, 'splash should render on launch for the GM').toBeVisible({ timeout: 10000 });

    // 2) It lists the three required dependencies (pf2e, automate-fvtt, fabricate).
    await expect(splash.locator('.bandits-dep')).toHaveCount(3);

    // 3) The import button is present and enabled (the world is pf2e).
    const importButton = splash.locator('[data-action="importAdventure"]');
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();

    // 4) Clicking it opens Foundry's native Adventure importer.
    await importButton.click();
    await expect(
      page.locator('.window-title', { hasText: 'Adventure: Bandits on the River' }),
      'native AdventureImporter should open'
    ).toBeVisible({ timeout: 10000 });

    // Leave the world as we found it (the import click set the flag).
    await page.evaluate((id) => globalThis.game.settings.set(id, 'splashSeen', false), MODULE_ID);
  });
});

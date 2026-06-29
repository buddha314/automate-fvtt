// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Contract test for the single Fabricate seam (scripts/fabricate-adapter.js).
 *
 * Fabricate is pre-1.0 with a shifting API, and our adapter depends on a handful
 * of de-facto-internal surfaces (no documented outward API exists beyond
 * `game.fabricate.gathering.*` and the published hooks). This test pins those
 * surfaces against the LIVE module so drift surfaces here instead of silently in
 * production — it is the runtime half of the source-grounded assumptions baked
 * into the adapter and its unit tests.
 *
 * Like the splash test, it SKIPS gracefully when it can't reach a ready world or
 * take the GM seat, so CI stays green. To run it for real:
 *   1. Launch Foundry with a world that has the `fabricate` module active.
 *   2. Log OUT to the join screen (Foundry locks a connected user's seat) —
 *      keep the world active; do NOT "Return to Setup".
 *   3. npx playwright test fabricate-surface
 *
 * Config via env: FOUNDRY_URL (default http://localhost:30000),
 *                 FOUNDRY_USER (default Gamemaster).
 */

const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_USER = process.env.FOUNDRY_USER || 'Gamemaster';
const MODULE_ID = 'fabricate';

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

test.describe('Fabricate adapter — live surface contract', () => {
  test('exposes the methods, hook, and component shape the adapter depends on', async ({ page }) => {
    const skipReason = await joinAsGM(page);
    test.skip(Boolean(skipReason), skipReason ?? '');

    const moduleActive = await page.evaluate(
      (id) => globalThis.game?.modules?.get(id)?.active === true,
      MODULE_ID
    );
    test.skip(!moduleActive, `${MODULE_ID} is not active in this world.`);

    // Probe the live surface read-only (no world mutation).
    const probe = await page.evaluate(() => {
      const fab = globalThis.game?.fabricate;
      const t = (v) => typeof v;
      let systems = [];
      try {
        systems = fab?.getCraftingSystemManager?.()?.getSystems?.() ?? [];
      } catch {
        systems = [];
      }
      const sampleComponent = systems.flatMap((s) => s?.components ?? [])[0] ?? null;
      return {
        version: globalThis.game?.modules?.get('fabricate')?.version ?? null,
        hasNamespace: !!fab,
        startGatheringAttempt: t(fab?.startGatheringAttempt),
        craft: t(fab?.craft),
        exportSystem: t(fab?.exportSystem),
        importSystemFromFile: t(fab?.importSystemFromFile),
        getCraftingSystemManager: t(fab?.getCraftingSystemManager),
        getInventory: t(fab?.getInventory), // expected 'undefined' — we scan items instead
        attemptCompletedHook: fab?.api?.HOOKS?.gathering?.ATTEMPT_COMPLETED ?? null,
        systemCount: systems.length,
        sampleComponentKeys: sampleComponent ? Object.keys(sampleComponent) : null,
      };
    });

    console.log('[fabricate-surface] probe:', JSON.stringify(probe, null, 2));

    // 1) The methods the adapter resolves by name must exist.
    expect(probe.hasNamespace, 'game.fabricate should be present').toBe(true);
    expect(probe.startGatheringAttempt, 'startGatheringAttempt').toBe('function');
    expect(probe.craft, 'craft').toBe('function');
    expect(probe.exportSystem, 'exportSystem').toBe('function');
    expect(probe.importSystemFromFile, 'importSystemFromFile').toBe('function');
    expect(probe.getCraftingSystemManager, 'getCraftingSystemManager').toBe('function');

    // 2) The published gathering-completion hook our projection subscribes to.
    expect(probe.attemptCompletedHook, 'attemptCompleted hook constant').toBe(
      'fabricate.gathering.attemptCompleted'
    );

    // 3) There is still no getInventory API — our item-scan approach is required.
    //    Recorded (not hard-asserted) so a future re-introduction is visible, not a red build.
    if (probe.getInventory === 'function') {
      console.warn('[fabricate-surface] NOTE: fabricate now exposes getInventory — revisit readInventory.');
    }

    // 4) If a system with components exists, the readInventory matcher's fields
    //    must be present. With no seeded system yet, record and pass.
    if (probe.sampleComponentKeys) {
      expect(probe.sampleComponentKeys, 'component carries id').toContain('id');
      expect(probe.sampleComponentKeys, 'component carries sourceItemUuid').toContain(
        'sourceItemUuid'
      );
    } else {
      console.log(
        `[fabricate-surface] NOTE: ${probe.systemCount} system(s), no components to sample — ` +
          'seed a crafting system to verify the inventory matcher end-to-end.'
      );
    }
  });
});

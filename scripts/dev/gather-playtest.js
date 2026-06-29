/**
 * Rung 2 playtest harness — a runnable gathering scenario (dev/playtest only;
 * exposed at `api.dev`). A Keep auto-harvests a resource from a Fabricate gathering
 * environment + task on the world-time tick; the yield projects into the stockpile.
 *
 * `setupGatheringPlaytest()` builds it: a source item + a crafting system with a
 * gatherable component, a gathering **task** (written to Fabricate's `gatheringConfig`
 * world setting — there is no public task API), a gathering **environment** (via the
 * public `getGatheringEnvironmentStore()`), a fresh Keep, the component→resource map,
 * and a HARVEST rule bound on the tick. `teardownGatheringPlaytest()` removes it all.
 *
 * IMPORTANT: Fabricate **blocks gathering while the game is paused** (`GAME_PAUSED`),
 * so the tick-driven harvest only runs in an **unpaused** world. Advance time with
 * the game unpaused to see ore/berries flow in.
 *
 * Harvested items (like crafted output) carry no source reference, so they are
 * recognized by **name** (see `component-map.js`); the component uses a distinct name.
 * @module dev/gather-playtest
 */

import { MODULE_ID } from "../constants.js";
import { log } from "../logger.js";

const SID = "automate-fvtt-gather-playtest";
const TASK_ID = "forage";
const RULE_ID = `${MODULE_ID}.playtest.harvest`;
const BERRY = { id: "berry", name: "Playtest Berry" };
const MARK = { [MODULE_ID]: { playtest: true } };
const GCFG = "gatheringConfig";

function physicalItemType() {
  const types = (game.documentTypes?.Item ?? []).filter((t) => t !== "base");
  return ["equipment", "treasure", "consumable", "loot"].find((t) => types.includes(t)) ?? types[0];
}

/**
 * Build the gathering playtest scenario. Idempotent: tears down a prior run first.
 * @param {object} [opts]
 * @param {number} [opts.intervalSeconds=86400] harvest cadence for the tick-driven rule
 * @returns {Promise<{keepId: string, environmentId: string, taskId: string}>}
 */
export async function setupGatheringPlaytest({ intervalSeconds = 86400 } = {}) {
  const api = game.modules.get(MODULE_ID)?.api;
  const fab = game.fabricate;
  if (!api?.rules || !fab) throw new Error("[automate-fvtt] gathering playtest: API or Fabricate unavailable.");
  await teardownGatheringPlaytest();

  const csm = fab.getCraftingSystemManager();
  const envStore = fab.getGatheringEnvironmentStore();
  const itemType = physicalItemType();

  // Source item the gatherable component is backed by (distinct name — yield matches by name).
  const berrySrc = await Item.create({ name: BERRY.name, type: itemType, system: { quantity: 1 }, flags: MARK });

  // System with gathering enabled + the gatherable component.
  const sys = await csm.createSystem({ id: SID, name: "Gather Playtest", resolutionMode: "simple", features: { gathering: true } });
  const cBerry = await csm.createItem(sys.id, { id: BERRY.id, name: BERRY.name, sourceItemUuid: berrySrc.uuid });

  // Task with a guaranteed drop (d100, dropRate 100) — written directly to the
  // gatheringConfig setting (no public task API). GM-gated by the world setting.
  const cfg = game.settings.get("fabricate", GCFG) ?? {};
  cfg.systems ??= {};
  cfg.systems[sys.id] ??= {};
  cfg.systems[sys.id].tasks ??= [];
  cfg.systems[sys.id].tasks = cfg.systems[sys.id].tasks.filter((t) => t.id !== TASK_ID);
  cfg.systems[sys.id].tasks.push({
    id: TASK_ID, name: "Forage Berries", enabled: true, resolutionMode: "d100",
    dropRows: [{ id: "d1", componentId: cBerry.id, quantity: 1, dropRate: 100, enabled: true }],
  });
  await game.settings.set("fabricate", GCFG, cfg);

  // Environment referencing the task (no sceneUuid → not scene-gated; no canvas needed).
  const env = await envStore.create({
    craftingSystemId: sys.id, name: "Playtest Grounds", selectionMode: "targeted",
    enabledTaskIds: [TASK_ID], enabled: true,
  });

  // A fresh Keep as the gatherer + the harvest rule + the component→resource map.
  const keep = await api.keeps.create({ name: "Gather Playtest Keep" });
  await keep.setFlag(MODULE_ID, "playtest", true);
  api.rules.setComponentMap([{ componentId: BERRY.id, resourceKey: "berry" }]);
  api.rules.register(api.rules.makeFabricateRule({
    id: RULE_ID,
    intervalSeconds,
    fabricate: { op: api.rules.FAB_OP.HARVEST, environmentId: env.id, taskId: TASK_ID },
  }));

  log.info(
    `gathering playtest ready — Keep "${keep.name}" (${keep.id}) harvests "${BERRY.name}" from env ${env.id}. ` +
      `UNPAUSE the game, then advance time to harvest (Fabricate blocks gathering while paused).`
  );
  return { keepId: keep.id, environmentId: env.id, taskId: TASK_ID };
}

/**
 * Remove everything the gathering playtest created. Safe to call when nothing exists.
 * @returns {Promise<void>}
 */
export async function teardownGatheringPlaytest() {
  const api = game.modules.get(MODULE_ID)?.api;
  const fab = game.fabricate;
  try {
    api?.rules?.unregister?.(RULE_ID);
    api?.rules?.setComponentMap?.([]);
  } catch (err) { log.warn(`gathering teardown (rules): ${err?.message ?? err}`); }

  // Environments (public store), then the gatheringConfig tasks, then the system.
  try {
    const envStore = fab?.getGatheringEnvironmentStore?.();
    for (const e of envStore?.listBySystem?.(SID) ?? []) await envStore.delete(e.id);
  } catch (err) { log.warn(`gathering teardown (env): ${err?.message ?? err}`); }
  try {
    const cfg = game.settings.get("fabricate", GCFG) ?? {};
    if (cfg.systems?.[SID]) { delete cfg.systems[SID]; await game.settings.set("fabricate", GCFG, cfg); }
  } catch (err) { log.warn(`gathering teardown (config): ${err?.message ?? err}`); }
  try {
    const csm = fab?.getCraftingSystemManager?.();
    if (csm?.getSystem?.(SID)) await csm.deleteSystem?.(SID);
  } catch (err) { log.warn(`gathering teardown (system): ${err?.message ?? err}`); }

  // Flagged Keeps + source items.
  for (const actor of game.actors?.filter((a) => a.getFlag?.(MODULE_ID, "playtest")) ?? []) {
    try { await actor.delete(); } catch (err) { log.warn(`gathering teardown (keep): ${err?.message ?? err}`); }
  }
  for (const item of game.items?.filter((i) => i.getFlag?.(MODULE_ID, "playtest")) ?? []) {
    try { await item.delete(); } catch (err) { log.warn(`gathering teardown (item): ${err?.message ?? err}`); }
  }
}

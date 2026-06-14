/**
 * Phase 3 rules engine — the Foundry-facing wiring around the pure core in
 * {@link module:rules/rules}.
 *
 * Subscribes one callback to the Phase 2 tick dispatcher. On every world-time
 * advance it evaluates the registered rules against each Keep and writes the
 * resulting stockpile deltas. Writes are made by a **single authoritative GM**
 * so a multi-client world applies each tick exactly once (the multiplayer
 * authority risk called out in the epic); other clients just observe the
 * resulting `updateActor` / `keepUpdated` broadcast.
 *
 * @module rules/rule-engine
 */

import { MODULE_ID, SETTINGS } from "../constants.js";
import { log } from "../logger.js";
import { listKeeps } from "../keep-api.js";
import { onTick } from "../time/tick-dispatcher.js";
import { computeTickPlan, listRules, DELIVERY } from "./rules.js";

/** Stable id for our subscription on the tick dispatcher. */
const TICK_ID = "rules-engine";

/**
 * Is *this* client the one designated to apply rules? Uses Foundry's elected
 * active GM; falls back to "lowest-id active GM" on builds without `activeGM`.
 * Non-GMs and secondary GMs return false so only one client writes.
 * @returns {boolean}
 */
function isAuthoritativeGM() {
  const users = game.users;
  if (users?.activeGM) return users.activeGM === game.user;
  if (!game.user?.isGM) return false;
  const firstGM = users
    ?.filter((u) => u.isGM && u.active)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  return firstGM === game.user;
}

/**
 * Apply one tick to every Keep. Computes a batched update per Keep from the pure
 * plan, clamps each resource at zero, and writes once. Safe to call for any tick
 * context; no-ops on backward/sub-interval time because the plan comes back empty.
 * @param {import("../time/tick-dispatcher.js").TickContext} ctx
 * @returns {Promise<void>}
 */
export async function applyTick({ prevTime, worldTime }) {
  if (!isAuthoritativeGM()) return;
  const rules = listRules();
  const defaultDelivery =
    game.settings?.get(MODULE_ID, SETTINGS.DEFAULT_PRODUCER_DELIVERY) ?? DELIVERY.KEEP;

  for (const keep of listKeeps()) {
    try {
      const { deltas, ports, applications } = computeTickPlan(
        keep.system?.stockpile ?? {},
        keep.system ?? {},
        rules,
        prevTime,
        worldTime,
        { defaultDelivery }
      );
      if (!applications.length) continue;

      const update = {};
      // Direct (`keep` delivery) outputs and all input draws → stockpile.
      for (const [res, d] of Object.entries(deltas)) {
        if (!d) continue;
        const current = Number(keep.system?.stockpile?.[res] ?? 0);
        update[`system.stockpile.${res}`] = Math.max(0, current + d);
      }
      // Routed (`port` delivery) outputs accumulate in per-buffer holds.
      for (const [bufferKey, resources] of Object.entries(ports)) {
        for (const [res, d] of Object.entries(resources)) {
          if (!d) continue;
          const current = Number(keep.system?.buffers?.[bufferKey]?.[res] ?? 0);
          update[`system.buffers.${bufferKey}.${res}`] = Math.max(0, current + d);
        }
      }
      if (Object.keys(update).length) {
        await keep.update(update);
        log.debug(
          `rules: ${keep.name} applied ${applications.map((a) => a.ruleId).join(", ")}`
        );
      }
    } catch (err) {
      log.error(`rules: failed to apply tick to Keep "${keep?.name}":`, err);
    }
  }
}

/**
 * Wire the rules engine to the tick dispatcher. Call once during init/ready,
 * after {@link module:time/tick-dispatcher.registerTickDispatcher}.
 */
export function registerRulesEngine() {
  onTick(TICK_ID, (ctx) => {
    // Fire-and-forget: the dispatcher loop is sync; we don't want one Keep's
    // async write to stall the others. Errors are handled inside applyTick.
    void applyTick(ctx);
  });
  log.debug("rules engine registered");
}

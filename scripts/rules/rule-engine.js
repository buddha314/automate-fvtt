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
import { FAB_OP, planFabricateOps } from "../fabricate/fabricate-rules.js";
import {
  createComponentMap,
  managedResourceKeys,
  projectInventory,
  applyProjection,
} from "../fabricate/component-map.js";

/** Stable id for our subscription on the tick dispatcher. */
const TICK_ID = "rules-engine";

/**
 * Per-rule, per-tick ceiling on Fabricate op invocations. A large time jump can
 * imply thousands of harvests/crafts; we cap and log rather than hammer the
 * Fabricate API (and the actor's Item collection) in a single synchronous burst.
 * Anything beyond the cap simply lands on the next tick.
 */
const MAX_FAB_OPS_PER_RULE = 1000;

/**
 * Fabricate wiring, injected from the module bootstrap once the handshake has
 * resolved (see {@link configureFabricate}). Null/identity until then, so the
 * engine runs as the pure Phase 3 numeric economy when Fabricate is absent.
 */
let fabricateAdapter = null;
let componentMap = createComponentMap();

/**
 * Inject the Fabricate adapter and component map the engine uses to back the
 * economy. Called from the `ready` hook after the adapter handshake.
 * @param {object} cfg
 * @param {import("../fabricate-adapter.js").FabricateAdapter|null} [cfg.adapter]
 * @param {import("../fabricate/component-map.js").ComponentMap} [cfg.componentMap]
 */
export function configureFabricate({ adapter = null, componentMap: map } = {}) {
  fabricateAdapter = adapter;
  if (map) componentMap = map;
}

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
  const fab = fabricateAdapter?.available ? fabricateAdapter : null;

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
      if (Object.keys(update).length) await keep.update(update);

      // Phase 4: run any Fabricate-backed rules (harvest/craft), then project
      // the Keep's resulting component inventory back into the stockpile. Skips
      // cleanly when Fabricate is unavailable — the numeric economy above still
      // applied. Craft capping reads the just-written stockpile (the prior
      // projection); ingredients harvested *this* tick become available next.
      if (fab) {
        const ops = planFabricateOps(applications, rules, keep.system?.stockpile ?? {});
        if (ops.length) {
          await runFabricateOps(fab, keep, ops);
          await syncFabricateInventory(fab, keep);
        }
      }

      log.debug(
        `rules: ${keep.name} applied ${applications.map((a) => a.ruleId).join(", ")}`
      );
    } catch (err) {
      log.error(`rules: failed to apply tick to Keep "${keep?.name}":`, err);
    }
  }
}

/**
 * Execute the planned Fabricate operations against a Keep, each repeated
 * `op.times` (capped by {@link MAX_FAB_OPS_PER_RULE}). Harvests pull a node's
 * available yield onto the Keep; crafts run a recipe with the Keep as the
 * crafting actor. Per-call failures are already swallowed and logged inside the
 * adapter, so one bad op doesn't abort the rest.
 * @param {import("../fabricate-adapter.js").FabricateAdapter} fab
 * @param {Actor} keep
 * @param {import("../fabricate/fabricate-rules.js").FabricateOp[]} ops
 * @returns {Promise<void>}
 */
async function runFabricateOps(fab, keep, ops) {
  for (const op of ops) {
    if (op.op === FAB_OP.HARVEST) {
      // Gathering: start ONE attempt for the Keep (the gatherer) at the bound
      // environment/task. Fabricate creates a timed run and resolves it on its
      // own world-time hook — which our tick advances — so we don't loop `times`;
      // the elapsed span drives how much the run yields. Yield lands in the Keep's
      // inventory and is projected into the stockpile by syncFabricateInventory.
      await fab.startGathering({ actor: keep, environmentId: op.environmentId, taskId: op.taskId });
      continue;
    }
    // Crafting (parked until Fabricate ships it): run the recipe `times` times,
    // capped so a big time jump doesn't hammer the API in one tick.
    const times = Math.min(op.times, MAX_FAB_OPS_PER_RULE);
    if (times < op.times) {
      log.warn(
        `rules: ${keep.name} ${op.op} "${op.ruleId}" wanted ${op.times} runs; capped at ` +
          `${MAX_FAB_OPS_PER_RULE} this tick (remainder lands next tick).`
      );
    }
    for (let i = 0; i < times; i++) {
      await fab.craft({ recipeId: op.recipeId, actor: keep, ingredientSetId: op.ingredientSetId });
    }
  }
}

/**
 * Re-read a Keep's Fabricate component inventory and reconcile it into the
 * stockpile, writing only the managed resource keys that actually changed. This
 * is what makes Fabricate-held Items visible to the sheet and to downstream
 * numeric rules (deliverable #1).
 * @param {import("../fabricate-adapter.js").FabricateAdapter} fab
 * @param {Actor} keep
 * @returns {Promise<void>}
 */
async function syncFabricateInventory(fab, keep) {
  const inventory = fab.readInventory(keep);
  const projection = projectInventory(inventory, componentMap);
  const current = keep.system?.stockpile ?? {};
  const reconciled = applyProjection(current, projection, componentMap);

  const managed = new Set([...managedResourceKeys(componentMap), ...Object.keys(projection)]);
  const update = {};
  for (const key of managed) {
    const next = reconciled[key] ?? 0;
    if (Number(current[key] ?? 0) !== next) update[`system.stockpile.${key}`] = next;
  }
  if (Object.keys(update).length) await keep.update(update);
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

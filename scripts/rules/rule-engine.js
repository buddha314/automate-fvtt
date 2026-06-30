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

import { MODULE_ID, SETTINGS, KEEP_DATA_PATH } from "../constants.js";
import { log } from "../logger.js";
import { listKeeps, getKeepData } from "../keep-api.js";
import { onTick } from "../time/tick-dispatcher.js";
import { computeTickPlan, listRules, DELIVERY } from "./rules.js";
import { FAB_OP, planFabricateOps } from "../fabricate/fabricate-rules.js";
import {
  createComponentMap,
  managedResourceKeys,
  projectInventory,
  applyProjection,
} from "../fabricate/component-map.js";
import { computeOutputPlan, routeOverflow, OVERFLOW_BUFFER } from "./output-pipeline.js";

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
 * Output-pipeline config (#46): per-resource storage caps and the overflow policy.
 * Empty caps → the pipeline no-ops, preserving the unbounded Phase-3 behaviour.
 * @type {Object<string, number>}
 */
let capacities = {};
/** @type {"lost"|"buffered"|"auto-sold"} */
let overflowPolicy = "lost";

/**
 * Configure the output pipeline. Set per-resource `capacities` and/or the overflow
 * `policy`; call from the API. Capacities replace the prior map; policy persists.
 * @param {object} cfg
 * @param {Object<string, number>} [cfg.capacities]
 * @param {"lost"|"buffered"|"auto-sold"} [cfg.policy]
 */
export function configureOutput({ capacities: caps, policy } = {}) {
  if (caps) capacities = { ...caps };
  if (policy) overflowPolicy = policy;
}

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
      const data = getKeepData(keep);
      const { deltas, ports, applications } = computeTickPlan(
        data.stockpile ?? {},
        data,
        rules,
        prevTime,
        worldTime,
        { defaultDelivery }
      );
      if (applications.length) {
        const update = {};
        // Direct (`keep` delivery) outputs and all input draws → stockpile.
        for (const [res, d] of Object.entries(deltas)) {
          if (!d) continue;
          const current = Number(data.stockpile?.[res] ?? 0);
          update[`${KEEP_DATA_PATH}.stockpile.${res}`] = Math.max(0, current + d);
        }
        // Routed (`port` delivery) outputs accumulate in per-buffer holds.
        for (const [bufferKey, resources] of Object.entries(ports)) {
          for (const [res, d] of Object.entries(resources)) {
            if (!d) continue;
            const current = Number(data.buffers?.[bufferKey]?.[res] ?? 0);
            update[`${KEEP_DATA_PATH}.buffers.${bufferKey}.${res}`] = Math.max(0, current + d);
          }
        }
        if (Object.keys(update).length) await keep.update(update);

        // Phase 4: run any Fabricate-backed rules (harvest/craft), then project
        // the Keep's resulting component inventory back into the stockpile. Skips
        // cleanly when Fabricate is unavailable — the numeric economy above still
        // applied. Craft capping reads the just-written stockpile (the prior
        // projection); ingredients harvested *this* tick become available next.
        if (fab) {
          const ops = planFabricateOps(applications, rules, data.stockpile ?? {});
          if (ops.length) {
            await runFabricateOps(fab, keep, ops);
            await syncFabricateInventory(fab, keep);
          }
        }

        log.debug(
          `rules: ${keep.name} applied ${applications.map((a) => a.ruleId).join(", ")}`
        );
      }

      // Output pipeline tail (#46): clamp the stockpile to per-resource capacities
      // and route the overflow (lost | buffered | auto-sold). Runs every tick so
      // caps hold even on idle ticks; no-ops when no capacities are configured.
      await applyOutputPipeline(fab, keep);
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
      // environment/task. Outcomes are roll/check-driven and may yield nothing.
      // Immediate tasks resolve synchronously here (and are swept up by the
      // syncFabricateInventory call after these ops); timed tasks create a run
      // Fabricate matures later on its own world-time processing, whose completion
      // we project via the `attemptCompleted` hook (see registerFabricateGatheringSync).
      // Either way we start one attempt per fired rule and let Fabricate decide the yield.
      await fab.startGathering({ actor: keep, environmentId: op.environmentId, taskId: op.taskId });
      continue;
    }
    // Crafting: run the recipe up to `times` times, capped so a big time jump
    // doesn't hammer the API in one tick. Stop early on a hard failure (ingredients
    // exhausted mid-loop, a misconfigured required check, or no craft method) — the
    // post-op inventory sync reconciles whatever actually crafted.
    const times = Math.min(op.times, MAX_FAB_OPS_PER_RULE);
    if (times < op.times) {
      log.warn(
        `rules: ${keep.name} ${op.op} "${op.ruleId}" wanted ${op.times} runs; capped at ` +
          `${MAX_FAB_OPS_PER_RULE} this tick (remainder lands next tick).`
      );
    }
    for (let i = 0; i < times; i++) {
      const res = await fab.craft({ recipeId: op.recipeId, actor: keep, ingredientSetId: op.ingredientSetId });
      if (!res.attempted) break;
      if (!res.success) {
        log.debug(
          `rules: ${keep.name} craft "${op.ruleId}" stopped after ${i} run(s): ` +
            `${res.message ?? "unsuccessful"}`
        );
        break;
      }
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
  const current = getKeepData(keep).stockpile ?? {};
  const reconciled = applyProjection(current, projection, componentMap);

  const managed = new Set([...managedResourceKeys(componentMap), ...Object.keys(projection)]);
  const update = {};
  for (const key of managed) {
    const next = reconciled[key] ?? 0;
    if (Number(current[key] ?? 0) !== next) update[`${KEEP_DATA_PATH}.stockpile.${key}`] = next;
  }
  if (Object.keys(update).length) await keep.update(update);
}

/**
 * Output pipeline tail (#46): clamp the Keep's stockpile to the configured per-resource
 * capacities and route the overflow by policy (lost | buffered | auto-sold). For
 * Fabricate-managed resources the overflow items are removed so the cap holds against
 * the next projection. No-op when no capacities are configured.
 * @param {import("../fabricate-adapter.js").FabricateAdapter|null} fab
 * @param {Actor} keep
 * @returns {Promise<void>}
 */
async function applyOutputPipeline(fab, keep) {
  const data = getKeepData(keep);
  // Per-keep capacities (from the Keep's tier, written by the evolution engine)
  // override/extend the engine-global capacities.
  const effectiveCaps = { ...capacities, ...(data.capacities ?? {}) };
  if (!Object.keys(effectiveCaps).length) return;
  const { clamped, overflow } = computeOutputPlan(data.stockpile ?? {}, effectiveCaps);
  const overRes = Object.keys(overflow);
  if (!overRes.length) return;

  // Prices for auto-sold: the best buy price among this Keep's merchants per resource.
  const prices = {};
  if (overflowPolicy === "auto-sold") {
    for (const m of data.merchants ?? []) {
      for (const b of m.buys ?? []) {
        const p = Number(b.price) || 0;
        if (p > 0 && (prices[b.resourceKey] == null || p > prices[b.resourceKey])) prices[b.resourceKey] = p;
      }
    }
  }
  const routed = routeOverflow(overflow, overflowPolicy, { prices });

  // Make caps stick for Fabricate-managed resources by removing the overflow items.
  if (fab) {
    for (const res of overRes) {
      const componentId = componentMap.byResource?.get(res);
      if (componentId) {
        try { await fab.removeComponentUnits(keep, componentId, overflow[res]); }
        catch (err) { log.warn(`output: removeComponentUnits(${res}) failed: ${err?.message ?? err}`); }
      }
    }
  }

  const update = {};
  for (const res of overRes) update[`${KEEP_DATA_PATH}.stockpile.${res}`] = clamped[res];
  for (const [res, amt] of Object.entries(routed.bufferDeltas)) {
    const cur = Number(data.buffers?.[OVERFLOW_BUFFER]?.[res] ?? 0);
    update[`${KEEP_DATA_PATH}.buffers.${OVERFLOW_BUFFER}.${res}`] = cur + amt;
  }
  if (routed.revenue > 0) {
    update[`${KEEP_DATA_PATH}.treasury`] = Math.max(0, Number(data.treasury ?? 0) + routed.revenue);
  }
  if (Object.keys(update).length) await keep.update(update);
  log.debug(`output: ${keep.name} overflow ${JSON.stringify(overflow)} via ${overflowPolicy} (+${routed.revenue} treasury).`);
}

/** Hook id of the active gathering-completion subscription, for idempotent re-bind. */
let gatheringHookId = null;

/**
 * Subscribe to Fabricate's public gathering-completion hook so a Keep's harvested
 * components are projected into its stockpile the moment an attempt resolves —
 * covering immediate attempts *and* timed runs that mature on a later tick (or
 * outside our op planning entirely). Only the authoritative GM writes. Idempotent:
 * re-binding replaces the prior subscription. No-ops when Fabricate is unavailable.
 *
 * Call after {@link configureFabricate} has injected the adapter (e.g. at `ready`).
 */
export function registerFabricateGatheringSync() {
  const fab = fabricateAdapter?.available ? fabricateAdapter : null;
  const hook = fab?.gatheringCompletedHook?.();
  if (gatheringHookId != null && hook) {
    Hooks.off(hook, gatheringHookId);
    gatheringHookId = null;
  }
  if (!fab || !hook) return;
  gatheringHookId = Hooks.on(hook, (payload) => void onGatheringCompleted(payload));
  log.debug(`rules: subscribed to ${hook} for stockpile projection`);
}

/**
 * Project the gathering Keep's inventory when a Fabricate attempt completes.
 * @param {object} payload  the `attemptCompleted` hook payload
 * @returns {Promise<void>}
 */
async function onGatheringCompleted(payload) {
  if (!isAuthoritativeGM()) return;
  const fab = fabricateAdapter?.available ? fabricateAdapter : null;
  if (!fab) return;
  const keep = resolveKeepFromPayload(payload);
  if (!keep) return;
  try {
    await syncFabricateInventory(fab, keep);
  } catch (err) {
    log.warn(`rules: gathering sync for "${keep?.name}" failed: ${err?.message ?? err}`);
  }
}

/**
 * Resolve the managed Keep a gathering payload refers to, or null if the gatherer
 * is not one of our Keeps (so a PC/NPC gathering attempt is ignored).
 * @param {object} payload
 * @returns {Actor|null}
 */
function resolveKeepFromPayload(payload) {
  const { actorUuid, actorId } = payload ?? {};
  if (!actorUuid && !actorId) return null;
  for (const keep of listKeeps()) {
    if ((actorUuid && keep.uuid === actorUuid) || (actorId && keep.id === actorId)) return keep;
  }
  return null;
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

/**
 * Fabricate-backed economy rules (Phase 4, deliverables #2 & #3).
 *
 * A normal Phase 3 rule turns a unit count into fixed numeric stockpile deltas.
 * A Fabricate-backed rule instead delegates the *effect* to Fabricate — auto
 * harvesting a resource node, or running a crafting recipe — while still using
 * the engine's deterministic interval math to decide **how many times** to fire
 * over an elapsed span.
 *
 * The trick that keeps the pure core unchanged: a Fabricate rule carries empty
 * numeric `inputs`/`outputs`, so {@link module:rules/rules.computeTickPlan}
 * counts its intervals and records an `applications` entry but makes *no*
 * stockpile delta. This module then reads those applications and emits the
 * concrete Fabricate operations for the engine to execute. Pure and testable —
 * it imports nothing from Foundry or Fabricate.
 *
 * @module fabricate/fabricate-rules
 */

/** The two Fabricate operations a rule can drive. @enum {string} */
export const FAB_OP = Object.freeze({
  /** Auto-resolve gathering on a Fabricate resource node into the Keep (UC2). */
  HARVEST: "harvest",
  /** Run a Fabricate recipe with the Keep as the crafting actor (ore → ingot). */
  CRAFT: "craft",
});

/**
 * @typedef {Object} FabricateSpec
 * @property {"harvest"|"craft"} op
 * @property {string} [environmentId]     Scene-linked gathering environment id (harvest).
 * @property {string} [taskId]            Gathering task within the environment (harvest).
 * @property {string} [recipeId]          Recipe id (craft).
 * @property {string} [ingredientSetId]   Optional Fabricate ingredient-set selector (craft).
 * @property {Object<string, number>} [ingredients]  resourceKey → amount consumed
 *   per craft, in *stockpile* terms. Used only to cap craft count by what's on
 *   hand so we never fire a craft Fabricate will reject; the actual Item draw is
 *   Fabricate's job.
 */

/**
 * @typedef {Object} FabricateOp
 * @property {string} ruleId
 * @property {"harvest"|"craft"} op
 * @property {number} times              How many times to run this op this tick (craft only; harvest starts one run).
 * @property {string} [environmentId]
 * @property {string} [taskId]
 * @property {string} [recipeId]
 * @property {string} [ingredientSetId]
 */

/**
 * Is this rule delegated to Fabricate?
 * @param {object} rule
 * @returns {boolean}
 */
export function isFabricateRule(rule) {
  const op = rule?.fabricate?.op;
  return op === FAB_OP.HARVEST || op === FAB_OP.CRAFT;
}

/**
 * Build a well-formed Fabricate-backed {@link Rule}. Forces empty numeric
 * inputs/outputs (the effect is Fabricate's) so the pure engine counts its
 * intervals without touching the ledger.
 * @param {object} opts
 * @param {string} opts.id
 * @param {number} opts.intervalSeconds
 * @param {FabricateSpec} opts.fabricate
 * @param {"producer"|"converter"} [opts.kind]  defaults from op (harvest→producer, craft→converter)
 * @param {"count"|"asset"} [opts.binding="asset"]
 * @param {number} [opts.assetUnits=1]
 * @param {string} [opts.countKey]
 * @returns {object} a Rule
 */
export function makeFabricateRule({
  id,
  intervalSeconds,
  fabricate,
  kind,
  binding = "asset",
  assetUnits = 1,
  countKey,
}) {
  if (!id) throw new Error("[automate-fvtt] fabricate rule needs an id");
  if (!isFabricateRule({ fabricate })) {
    throw new Error(`[automate-fvtt] fabricate rule "${id}" needs fabricate.op of harvest|craft`);
  }
  const resolvedKind = kind ?? (fabricate.op === FAB_OP.CRAFT ? "converter" : "producer");
  return {
    id,
    kind: resolvedKind,
    binding,
    ...(binding === "count" ? { countKey } : { assetUnits }),
    intervalSeconds,
    inputs: {},
    outputs: {},
    fabricate: { ...fabricate },
  };
}

/**
 * Turn the engine's computed `applications` into the concrete Fabricate ops to
 * run this tick. For each fired Fabricate rule the raw repeat count is
 * `units × intervals`; a `craft` op is then **capped by the scarcest ingredient**
 * available in the (projected) stockpile so we never launch a craft Fabricate
 * would refuse. Harvests are uncapped (the node's own respawn limits yield).
 *
 * Pure: depends only on its arguments.
 *
 * @param {{ruleId: string, units: number, intervals: number}[]} applications
 *   the `applications` array from {@link module:rules/rules.computeTickPlan}
 * @param {object[]} rules  the rule set those applications came from
 * @param {Object<string, number>} [stockpile={}]  current ledger (projected), for craft capping
 * @returns {FabricateOp[]} ops with `times > 0`, in `applications` order
 */
export function planFabricateOps(applications, rules, stockpile = {}) {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const ops = [];

  for (const app of applications ?? []) {
    const rule = byId.get(app.ruleId);
    if (!isFabricateRule(rule)) continue;

    let times = (Number(app.units) || 0) * (Number(app.intervals) || 0);
    if (times <= 0) continue;

    const fab = rule.fabricate;
    if (fab.op === FAB_OP.CRAFT && fab.ingredients) {
      for (const [resourceKey, amt] of Object.entries(fab.ingredients)) {
        const per = Number(amt) || 0;
        if (per <= 0) continue;
        const avail = Math.max(0, Number(stockpile?.[resourceKey] ?? 0));
        times = Math.min(times, Math.floor(avail / per));
      }
    }
    if (times <= 0) continue;

    ops.push({
      ruleId: rule.id,
      op: fab.op,
      times,
      ...(fab.environmentId ? { environmentId: fab.environmentId } : {}),
      ...(fab.taskId ? { taskId: fab.taskId } : {}),
      ...(fab.recipeId ? { recipeId: fab.recipeId } : {}),
      ...(fab.ingredientSetId ? { ingredientSetId: fab.ingredientSetId } : {}),
    });
  }

  return ops;
}

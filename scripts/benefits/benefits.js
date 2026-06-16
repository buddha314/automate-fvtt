/**
 * The membership-benefits core (Change A — keep-benefits).
 *
 * This module is **pure** — it imports nothing from Foundry, so benefit
 * validation, eligibility, and resolution can be unit-tested off-platform (see
 * `test/benefits.test.js`). The Foundry wiring (Active Effect application,
 * membership/scene/tier hooks, GM prompts, the public API) lives in
 * {@link module:benefits/benefit-engine}. The definition registry and per-Keep
 * bindings (the "side module", Decision 8) live in
 * {@link module:benefits/benefit-store}.
 *
 * A **benefit** is a system-agnostic capability that members of a Keep derive
 * from membership. The engine never knows what a "long rest" is — it resolves
 * which benefits are *live* for a member (role / tier / condition gating) and
 * expresses each through one of four primitives. The four primitives:
 *
 * - `effect`     — a content-supplied Active Effect payload, applied untouched.
 * - `modifier`   — a named scalar queried via the API (price/rest multipliers …).
 * - `capability` — a permission/quota (stockpile withdrawal, storage, voting).
 * - `action`     — an invokable benefit; the engine emits an event, content runs it.
 *
 * @module benefits/benefits
 */

/** The four benefit expression primitives. */
export const PRIMITIVE = Object.freeze({
  EFFECT: "effect",
  MODIFIER: "modifier",
  CAPABILITY: "capability",
  ACTION: "action",
});

/** Valid primitive set, for validation. */
const PRIMITIVES = new Set(Object.values(PRIMITIVE));

/**
 * Resolution mode (reuses the rules-engine axis). Default is `interactive` so a
 * GM applies the benefit by hand; deterministic benefits opt into `auto`.
 */
export const MODE = Object.freeze({ AUTO: "auto", INTERACTIVE: "interactive" });

/** When a benefit is live. */
export const CONDITION = Object.freeze({ ALWAYS: "always", WHILE_PRESENT: "while-present" });

/**
 * How same-key `modifier` contributions combine. Default is `highest` —
 * highest-wins, akin to D&D's same-type-bonuses-don't-stack (Decision 7).
 * Content overrides per key where a system needs different semantics (e.g. a
 * price multiplier wants `lowest`; layered multipliers want `multiply`).
 * @enum {string}
 */
export const COMBINE = Object.freeze({
  HIGHEST: "highest",
  LOWEST: "lowest",
  ADDITIVE: "additive",
  MULTIPLY: "multiply",
});

/**
 * A benefit definition, registered by content (or the generic cookbook).
 * @typedef {Object} BenefitDef
 * @property {string} id
 * @property {"effect"|"modifier"|"capability"|"action"} primitive
 * @property {string} [name]
 * @property {string} [description]
 * @property {Object} [eligibility]
 * @property {string[]} [eligibility.roles]  allowed roles (opaque strings); empty/absent = any role
 * @property {number} [eligibility.minTier]  minimum numeric Keep tier (default 0; tier naming is a separate change)
 * @property {"always"|"while-present"} [condition]  default `always`
 * @property {"auto"|"interactive"} [mode]  default `interactive`
 * @property {Object} payload  primitive-specific:
 *   - effect:     `{ effect: <ActiveEffectData> }` applied to the member actor untouched
 *   - modifier:   `{ key: string, value: number, combine?: COMBINE }`
 *   - capability: `{ key: string, quota?: number }`
 *   - action:     `{ actionId: string, label?: string }`
 */

/**
 * Validate and normalize a benefit definition. Throws on a missing id or an
 * unknown primitive; fills the `interactive` mode and `always` condition
 * defaults. Returns a frozen normalized copy.
 * @param {BenefitDef} def
 * @returns {BenefitDef} normalized
 */
export function validateDefinition(def) {
  if (!def?.id) throw new Error("[automate-fvtt] benefit needs an id");
  if (!PRIMITIVES.has(def.primitive)) {
    throw new Error(
      `[automate-fvtt] benefit "${def.id}" has invalid primitive "${def.primitive}" ` +
        `(expected one of ${[...PRIMITIVES].join(", ")})`
    );
  }
  const eligibility = def.eligibility ?? {};
  return Object.freeze({
    ...def,
    mode: def.mode ?? MODE.INTERACTIVE,
    condition: def.condition ?? CONDITION.ALWAYS,
    eligibility: Object.freeze({
      roles: eligibility.roles ? [...eligibility.roles] : [],
      minTier: Number(eligibility.minTier ?? 0),
    }),
    payload: def.payload ?? {},
  });
}

/**
 * The per-member context the resolver gates on. Computed by the Foundry layer.
 * @typedef {Object} MemberContext
 * @property {string} role     the member's role (opaque string)
 * @property {number} [tier]   the Keep's current numeric tier (default 0)
 * @property {boolean} [present]  is the member's token on the Keep's scene now?
 */

/**
 * Is a benefit eligible and its condition met for a member right now?
 * Gates: role (empty `roles` = any), tier (`keep.tier >= minTier`), and condition
 * (`always`, or `while-present` requiring `ctx.present`).
 * @param {BenefitDef} def  a normalized definition
 * @param {MemberContext} ctx
 * @returns {boolean}
 */
export function isLive(def, ctx) {
  const roles = def.eligibility?.roles ?? [];
  if (roles.length && !roles.includes(ctx.role)) return false;
  if (Number(ctx.tier ?? 0) < Number(def.eligibility?.minTier ?? 0)) return false;
  if (def.condition === CONDITION.WHILE_PRESENT && !ctx.present) return false;
  return true;
}

/**
 * A live benefit in a resolution snapshot.
 * @typedef {Object} LiveBenefit
 * @property {string} id
 * @property {string} primitive
 * @property {string} mode
 * @property {Object} payload
 * @property {string} [name]
 */

/**
 * Resolve which benefits are live for a member — a pure snapshot of desired
 * state. Idempotent: the same inputs always yield the same result, so the
 * Foundry layer can safely diff it against applied state on every event.
 * @param {MemberContext} ctx
 * @param {BenefitDef[]} definitions  normalized definitions bound to the Keep
 * @returns {{ benefits: LiveBenefit[] }}
 */
export function computeResolution(ctx, definitions) {
  const benefits = [];
  for (const def of definitions) {
    if (!isLive(def, ctx)) continue;
    benefits.push({ id: def.id, primitive: def.primitive, mode: def.mode, payload: def.payload, name: def.name });
  }
  return { benefits };
}

/**
 * The benefits that should actually be *applied*: every `auto` benefit, plus any
 * `interactive` benefit the GM has approved (its id is in `approvedIds`).
 * @param {LiveBenefit[]} benefits
 * @param {Set<string>} [approvedIds]  GM-approved interactive benefit ids
 * @returns {LiveBenefit[]}
 */
export function appliedBenefits(benefits, approvedIds = new Set()) {
  return benefits.filter((b) => b.mode === MODE.AUTO || approvedIds.has(b.id));
}

/** Combine two same-key modifier values by strategy. @returns {number} */
function combineValues(strategy, a, b) {
  switch (strategy) {
    case COMBINE.LOWEST: return Math.min(a, b);
    case COMBINE.ADDITIVE: return a + b;
    case COMBINE.MULTIPLY: return a * b;
    case COMBINE.HIGHEST:
    default: return Math.max(a, b);
  }
}

/** Identity element for a combine strategy, so the first contribution wins cleanly. */
function combineSeed(strategy) {
  switch (strategy) {
    case COMBINE.LOWEST: return Infinity;
    case COMBINE.ADDITIVE: return 0;
    case COMBINE.MULTIPLY: return 1;
    case COMBINE.HIGHEST:
    default: return -Infinity;
  }
}

/**
 * Resolve `modifier` benefits into a `key → value` map. Same-key contributions
 * combine by the key's strategy — **highest-wins by default** (Decision 7);
 * content may set `payload.combine` per modifier. The strategy is taken from the
 * first contribution seen for a key (mixing strategies on one key is a content
 * error; first-wins keeps it deterministic).
 * @param {LiveBenefit[]} benefits  typically {@link appliedBenefits} output
 * @returns {Object<string, number>}
 */
export function resolveModifiers(benefits) {
  /** @type {Object<string, {strategy: string, value: number}>} */
  const acc = {};
  for (const b of benefits) {
    if (b.primitive !== PRIMITIVE.MODIFIER) continue;
    const { key, value, combine = COMBINE.HIGHEST } = b.payload ?? {};
    if (!key) continue;
    const v = Number(value) || 0;
    if (!acc[key]) acc[key] = { strategy: combine, value: combineSeed(combine) };
    acc[key].value = combineValues(acc[key].strategy, acc[key].value, v);
  }
  const out = {};
  for (const [key, { value }] of Object.entries(acc)) out[key] = value;
  return out;
}

/**
 * Resolve `capability` benefits into a `key → (quota|true)` map. Numeric quotas
 * for the same key sum; flag capabilities resolve to `true`.
 * @param {LiveBenefit[]} benefits
 * @returns {Object<string, (number|boolean)>}
 */
export function resolveCapabilities(benefits) {
  const out = {};
  for (const b of benefits) {
    if (b.primitive !== PRIMITIVE.CAPABILITY) continue;
    const { key, quota } = b.payload ?? {};
    if (!key) continue;
    if (quota === undefined) out[key] = out[key] === undefined ? true : out[key];
    else out[key] = (typeof out[key] === "number" ? out[key] : 0) + (Number(quota) || 0);
  }
  return out;
}

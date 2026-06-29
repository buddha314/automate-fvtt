/**
 * The benefits **side module** (Decision 8): the authoritative store of benefit
 * *definitions* and per-Keep *bindings*, kept off the Keep actor so content can
 * register/update them independently of actor persistence and the store can be
 * rebuilt from content on `automate-fvtt.ready`.
 *
 * Pure and Foundry-agnostic (just Maps) so it is unit-testable. The KeepModel
 * may hold lightweight bound-benefit-id references, but this store is the source
 * of truth for binding state.
 *
 * @module benefits/benefit-store
 */

import { validateDefinition } from "./benefits.js";

/** Registered benefit definitions: id → normalized {@link BenefitDef}. */
const definitions = new Map();

/** Per-Keep bindings: keepId → Map(benefitId → binding override). */
const bindings = new Map();

/**
 * A binding of a benefit to a Keep, with optional per-binding overrides that the
 * resolver folds over the definition (e.g. tighten `minTier` or `roles`).
 * @typedef {Object} Binding
 * @property {string} benefitId
 * @property {Object} [overrides]  partial {@link BenefitDef} fields to override
 */

/**
 * Register (or replace) a benefit definition. Re-registering an id overwrites it.
 * @param {BenefitDef} def
 * @returns {BenefitDef} the normalized, stored definition
 */
export function registerDefinition(def) {
  const normalized = validateDefinition(def);
  definitions.set(normalized.id, normalized);
  return normalized;
}

/** Remove a benefit definition. @param {string} id */
export function unregisterDefinition(id) {
  definitions.delete(id);
}

/** @returns {BenefitDef[]} all registered definitions. */
export function listDefinitions() {
  return [...definitions.values()];
}

/** @param {string} id @returns {BenefitDef|undefined} */
export function getDefinition(id) {
  return definitions.get(id);
}

/**
 * Bind a benefit to a Keep (idempotent on benefitId; re-binding updates overrides).
 * @param {string} keepId
 * @param {string} benefitId
 * @param {Object} [overrides]
 */
export function bind(keepId, benefitId, overrides = {}) {
  if (!bindings.has(keepId)) bindings.set(keepId, new Map());
  bindings.get(keepId).set(benefitId, { benefitId, overrides });
}

/** Remove a benefit binding from a Keep. @param {string} keepId @param {string} benefitId */
export function unbind(keepId, benefitId) {
  bindings.get(keepId)?.delete(benefitId);
}

/** @param {string} keepId @returns {Binding[]} the Keep's bindings. */
export function bindingsFor(keepId) {
  return [...(bindings.get(keepId)?.values() ?? [])];
}

/**
 * Resolve a Keep's bindings to normalized definitions with overrides applied.
 * Bindings whose definition is missing are skipped (content may have unregistered
 * it). This is what the resolver consumes.
 * @param {string} keepId
 * @returns {BenefitDef[]}
 */
export function definitionsForKeep(keepId) {
  const out = [];
  for (const { benefitId, overrides } of bindingsFor(keepId)) {
    const def = definitions.get(benefitId);
    if (!def) continue;
    out.push(overrides && Object.keys(overrides).length ? validateDefinition({ ...def, ...overrides }) : def);
  }
  return out;
}

/** Clear all definitions and bindings (used by tests and on a full rebuild). */
export function resetStore() {
  definitions.clear();
  bindings.clear();
}

/**
 * The stockpile ↔ Fabricate bridge (Phase 4, deliverable #1).
 *
 * Fabricate models resources as **real Foundry Items** (its "components") living
 * on an Actor; our economy models them as a numeric ledger — the Keep's
 * `system.stockpile` (resource key → quantity). This module is the **pure,
 * deterministic translation** between the two vocabularies, so it imports nothing
 * from Foundry or Fabricate and is fully unit-testable.
 *
 * The flow each tick (wired in {@link module:rules/rule-engine}):
 *   1. Fabricate ops (harvest/craft) mutate component Items on the Keep actor.
 *   2. We read those Items back as an inventory map (componentId → qty).
 *   3. {@link projectInventory} folds that into resource-keyed quantities.
 *   4. {@link applyProjection} makes the projection authoritative for the
 *      resource keys Fabricate owns, leaving purely-numeric resources untouched.
 *
 * **Ownership invariant:** a resource key is governed by *either* numeric rules
 * *or* Fabricate — never both. Mixing them would double-count, because the
 * projection in step 4 overwrites managed keys wholesale. Asset/count producers
 * (e.g. `ore-drill`, `garden-rations`) must target keys outside the component
 * map; Fabricate-backed rules target keys inside it.
 *
 * @module fabricate/component-map
 */

/**
 * @typedef {Object} ComponentMap
 * @property {Map<string, string>} byComponent  componentId → resourceKey
 * @property {Map<string, string>} byResource   resourceKey → componentId
 */

/**
 * Build a {@link ComponentMap} from explicit pairs. With no pairs the map is
 * empty and lookups fall back to identity (a component projects to a resource of
 * the same id) — handy for worlds whose component ids already read as resources.
 * Later pairs win on duplicate keys.
 * @param {{componentId: string, resourceKey: string}[]} [pairs=[]]
 * @returns {ComponentMap}
 */
export function createComponentMap(pairs = []) {
  const byComponent = new Map();
  const byResource = new Map();
  for (const { componentId, resourceKey } of pairs ?? []) {
    if (!componentId || !resourceKey) continue;
    byComponent.set(componentId, resourceKey);
    byResource.set(resourceKey, componentId);
  }
  return { byComponent, byResource };
}

/**
 * Resource key a Fabricate component lands in. Identity fallback for unmapped
 * components, so an unconfigured world still projects sensibly.
 * @param {ComponentMap} map
 * @param {string} componentId
 * @returns {string}
 */
export function componentToResource(map, componentId) {
  return map?.byComponent?.get(componentId) ?? componentId;
}

/**
 * Fabricate component id backing a stockpile resource. Identity fallback.
 * @param {ComponentMap} map
 * @param {string} resourceKey
 * @returns {string}
 */
export function resourceToComponent(map, resourceKey) {
  return map?.byResource?.get(resourceKey) ?? resourceKey;
}

/**
 * Resource keys the map explicitly governs — the Fabricate-owned slice of the
 * ledger. Used to decide which stockpile entries a projection is allowed to
 * overwrite.
 * @param {ComponentMap} map
 * @returns {Set<string>}
 */
export function managedResourceKeys(map) {
  return new Set(map?.byResource?.keys() ?? []);
}

/**
 * Fold a Fabricate inventory (componentId → qty) into resource-keyed totals.
 * Components mapping to the same resource key sum together; non-numeric or
 * negative quantities coerce to 0.
 * @param {Object<string, number>} inventory  componentId → quantity on hand
 * @param {ComponentMap} map
 * @returns {Object<string, number>} resourceKey → quantity
 */
export function projectInventory(inventory, map) {
  const out = {};
  for (const [componentId, qty] of Object.entries(inventory ?? {})) {
    const key = componentToResource(map, componentId);
    const n = Number(qty) || 0;
    out[key] = (out[key] ?? 0) + (n > 0 ? n : 0);
  }
  return out;
}

/**
 * Reconcile a projection into a stockpile. For every **managed** resource key —
 * the union of the map's resource keys and the keys present in the projection —
 * the projected quantity becomes authoritative (clamped at 0), so depleted
 * components correctly fall to zero. Unmanaged keys (purely-numeric resources
 * like `sp` or count-driven `rations`) pass through unchanged.
 *
 * Pure: returns a new object, never mutates its inputs.
 * @param {Object<string, number>} stockpile   current ledger (not mutated)
 * @param {Object<string, number>} projection  resourceKey → qty from Fabricate
 * @param {ComponentMap} map
 * @returns {Object<string, number>} the reconciled stockpile
 */
export function applyProjection(stockpile, projection, map) {
  const result = { ...(stockpile ?? {}) };
  const managed = new Set([
    ...managedResourceKeys(map),
    ...Object.keys(projection ?? {}),
  ]);
  for (const key of managed) {
    const v = Number(projection?.[key] ?? 0);
    result[key] = v > 0 ? v : 0;
  }
  return result;
}

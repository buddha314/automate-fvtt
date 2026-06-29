/**
 * The stockpile ↔ Fabricate bridge (Phase 4, deliverable #1).
 *
 * Fabricate models resources as **real Foundry Items** (its "components") living
 * on an Actor; our economy models them as a numeric ledger — the Keep's
 * stockpile (resource key → quantity, stored under the Keep's module flag). This module is the **pure,
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
 * Build a `sourceItemUuid → componentId` lookup across crafting systems.
 * Fabricate identifies an owned item as a managed component by its source
 * reference, so this index is the bridge between owned items and component ids.
 * Component ids are globally unique, so flattening systems is safe; a later
 * system wins on the (vanishingly unlikely) duplicate source uuid. Pure.
 * @param {{components?: {id: string, sourceItemUuid?: string}[]}[]} systems  crafting systems
 * @returns {Map<string, string>} sourceItemUuid → componentId
 */
export function buildComponentSourceIndex(systems) {
  const index = new Map();
  for (const system of systems ?? []) {
    for (const c of system?.components ?? []) {
      if (c?.sourceItemUuid && c?.id != null) index.set(c.sourceItemUuid, c.id);
    }
  }
  return index;
}

/** Normalize a name for matching (trim + lowercase). */
function normalizeName(name) {
  return String(name ?? "").trim().toLowerCase();
}

/**
 * Build a `normalizedName → componentId` lookup across crafting systems. This is
 * the fallback Fabricate itself uses ("source reference OR name"): items Fabricate
 * **crafts** carry NO source reference back to the component (verified against the
 * live craft engine), so they can only be recognized by name. Last component wins
 * on a duplicate name. Pure.
 * @param {{components?: {id: string, name?: string}[]}[]} systems
 * @returns {Map<string, string>} normalizedName → componentId
 */
export function buildComponentNameIndex(systems) {
  const index = new Map();
  for (const system of systems ?? []) {
    for (const c of system?.components ?? []) {
      if (c?.name && c?.id != null) index.set(normalizeName(c.name), c.id);
    }
  }
  return index;
}

/**
 * Resolve an owned Foundry item to a managed componentId, mirroring Fabricate's
 * matcher: first by **source reference** (`item.uuid`, `item._stats.compendiumSource`,
 * or the legacy `item.flags.core.sourceId` vs {@link buildComponentSourceIndex}),
 * then falling back to **name** (vs {@link buildComponentNameIndex}) — which is the
 * only way to recognize Fabricate-crafted output, since it carries no source ref.
 * Returns null when the item is not a managed component. Pure.
 * @param {object} item  a Foundry Item (or item-like with source/name fields)
 * @param {Map<string, string>} bySource  sourceItemUuid → componentId
 * @param {Map<string, string>} [byName]  normalizedName → componentId (optional fallback)
 * @returns {?string}
 */
export function matchComponentId(item, bySource, byName) {
  const candidates = [item?.uuid, item?._stats?.compendiumSource, item?.flags?.core?.sourceId];
  for (const src of candidates) {
    if (src && bySource?.has?.(src)) return bySource.get(src);
  }
  if (byName?.size && item?.name) {
    const id = byName.get(normalizeName(item.name));
    if (id) return id;
  }
  return null;
}

/**
 * Read an item's stack quantity defensively across game systems (dnd5e stores a
 * number at `system.quantity`; pf2e nests it at `system.quantity.value`). A
 * present-but-uncounted item defaults to 1; negatives/garbage coerce to 0. Pure.
 * @param {object} item
 * @returns {number}
 */
export function itemQuantity(item) {
  const q = item?.system?.quantity;
  const n = q != null && typeof q === "object" ? q.value : q;
  return Math.max(0, Number(n ?? 1) || 0);
}

/**
 * Fold an actor's items into a `componentId → quantity` map, given the crafting
 * systems that define the components. This is the pure core of the adapter's
 * `readInventory` (which supplies `systems` and `items` from the live world).
 * Items matching the same component sum together. Pure.
 * @param {object[]} systems  crafting systems (each with a `components` array)
 * @param {object[]} items    the actor's owned items
 * @returns {Object<string, number>} componentId → quantity
 */
export function scanComponentInventory(systems, items) {
  const out = {};
  const bySource = buildComponentSourceIndex(systems);
  const byName = buildComponentNameIndex(systems);
  if (!bySource.size && !byName.size) return out;
  for (const item of items ?? []) {
    const cid = matchComponentId(item, bySource, byName);
    if (!cid) continue;
    out[cid] = (out[cid] ?? 0) + itemQuantity(item);
  }
  return out;
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

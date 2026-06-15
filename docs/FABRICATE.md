# Fabricate integration (Phase 4)

Automate FVTT backs the Keep economy with [Fabricate](https://github.com/mistersilver-uk/fabricate)
instead of bespoke math: resource nodes auto-deposit their yield on time advance,
and recipes run as Keep converters (ore → ingot). Everything goes through the
single seam in `scripts/fabricate-adapter.js`, so Fabricate's pre-1.0 API drift
stays localized to one file.

## How it fits the rules engine

The Phase 3 engine stays unchanged and **pure**. A Fabricate-backed rule carries
empty numeric `inputs`/`outputs`, so `computeTickPlan` still counts *how many
times* it fires over an elapsed span (its `applications` entry) but makes no
numeric delta. The engine then:

1. writes the numeric/port deltas for ordinary rules (Phase 3 behaviour);
2. asks `planFabricateOps` how many harvests/crafts to run, capped by ingredients
   on hand for crafts;
3. runs those ops through the adapter against the Keep actor;
4. re-reads the Keep's Fabricate component inventory and **projects** it back into
   `system.stockpile`, so Items become visible to the sheet and downstream rules.

Writes happen on the single authoritative GM (same guard as Phase 3), so a
multi-client world applies each tick once.

## The stockpile ↔ component bridge

Fabricate stores resources as real Foundry Items ("components") on an actor; we
store them as a numeric ledger. `scripts/fabricate/component-map.js` is the pure,
deterministic translation:

- `createComponentMap([{ componentId, resourceKey }, …])` — configure the mapping
  (identity fallback when a component/resource is unmapped).
- `projectInventory(inventory, map)` — fold component counts into resource totals.
- `applyProjection(stockpile, projection, map)` — make the projection
  authoritative for the **managed** resource keys, leaving purely-numeric
  resources (`sp`, count-driven `rations`, …) untouched.

**Ownership invariant:** a resource key is governed by *either* numeric rules
*or* Fabricate — never both. A managed key is overwritten wholesale on each sync,
so a numeric producer pointing at the same key would be clobbered. Keep the two
sets disjoint.

## Authoring Fabricate-backed rules

```js
const api = game.modules.get("automate-fvtt").api;

// Map Fabricate components to ledger resources.
api.rules.setComponentMap([
  { componentId: "fab.iron-ore",   resourceKey: "ore"   },
  { componentId: "fab.iron-ingot", resourceKey: "ingot" },
]);

// Auto-harvest a resource node once per day (reuses Fabricate's node respawn).
api.rules.register(api.rules.makeFabricateRule({
  id: "iron-node",
  intervalSeconds: 86400,
  fabricate: { op: api.rules.FAB_OP.HARVEST, nodeId: "node.iron" },
}));

// Run a smelting recipe hourly, capped by the ore on hand.
api.rules.register(api.rules.makeFabricateRule({
  id: "smelt-iron",
  intervalSeconds: 3600,
  fabricate: {
    op: api.rules.FAB_OP.CRAFT,
    recipeId: "recipe.iron-ingot",
    ingredients: { ore: 2 }, // for craft-count capping only; Fabricate does the draw
  },
}));
```

## Notes & limits

- **Degrades cleanly:** when Fabricate is absent or its handshake fails, the
  engine runs as the pure Phase 3 numeric economy; Fabricate rules simply
  no-op (logged).
- **API drift:** the adapter resolves Fabricate methods (`craft`, `harvest`,
  `getInventory`, …) by name at call time across `game.fabricate` and its `api`,
  and degrades to a logged no-op when a method is missing. This is the one place
  to touch when upstream settles — see `dependency-strategy` notes and
  [fabricate#345](https://github.com/mistersilver-uk/fabricate/issues/345).
- **Per-tick op cap:** harvests/crafts are capped at `MAX_FAB_OPS_PER_RULE`
  (1000) per rule per tick; any remainder lands on the next tick (logged).
- **Within-tick latency:** crafts are capped by the stockpile as it stood at the
  start of the tick, so ingredients harvested *this* tick feed crafts on the
  *next* one.

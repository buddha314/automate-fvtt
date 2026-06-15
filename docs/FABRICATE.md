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

// Auto-gather from a scene-linked Fabricate environment/task once per day. The
// Keep is the gatherer; Fabricate creates a timed run and resolves it on its own
// world-time hook (which our tick advances), and the yield projects back into the
// stockpile. Gathering is the implemented Fabricate feature in rc.87.
api.rules.register(api.rules.makeFabricateRule({
  id: "river-fishing",
  intervalSeconds: 86400,
  fabricate: { op: api.rules.FAB_OP.HARVEST, environmentId: "env.river", taskId: "task.fish" },
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

## Providing recipes & nodes (seeding a crafting system)

Rather than hand-build recipes/components/nodes in every world, the module can
**seed a whole crafting system into Fabricate** from a JSON file it ships.
Fabricate's "Export System" produces an envelope —
`{ fabricateVersion, exportedAt, system, recipes }` — and
`game.fabricate.importSystemFromFile` reads it back (it accepts a **raw JSON
string**, so no file picker is needed). The adapter wraps this:

```js
const api = game.modules.get("automate-fvtt").api.fabricate;
await api.seedSystem("modules/automate-fvtt/data/fabricate/keep-economy.json");
// also: api.exportSystem(id), api.importSystem(jsonOrData, opts),
//       api.getSystem(id), api.listSystems()
```

Workflow: build the system once in Fabricate's UI → **Export System** → drop the
JSON in `data/fabricate/` → list it in `FABRICATE.SEED_SYSTEMS`
(`scripts/constants.js`). On `ready` the **primary GM** seeds each entry,
**idempotently** — a system whose id already exists is skipped, so reloads never
duplicate (`{ overwriteExisting: true }` forces a refresh). See
`data/fabricate/README.md`.

Two artifacts, two pipelines:

| Content | Ships as |
|---|---|
| Essences, components, recipes, **gathering realms/tasks** | the Fabricate system **export JSON** (`importSystemFromFile`) |
| Resource-**node placements** on a map | a **Scene compendium pack** (node data lives on Scene tiles) |

## Notes & limits

- **rc.87 feature status:** in Fabricate **1.0.0-rc.87 the only implemented
  player feature is Gathering** — the Crafting/Alchemy/Journal/Inventory tabs are
  "Coming soon". So the **harvest** path (gathering) is live, while the **craft**
  path is **parked** until Fabricate ships its Crafting tab. Until then, model
  crafting with the engine's own numeric **converter** rules.
- **Gathering shape:** a harvest rule starts a Fabricate gathering attempt for the
  Keep at a scene-linked `environmentId` + `taskId`. Fabricate creates a timed run
  and resolves it on its **own** `updateWorldTime` hook (which our tick advances),
  so we start one attempt per fired rule and let the elapsed span drive the yield;
  it lands in the Keep's inventory and projects into the stockpile.
- **Degrades cleanly:** when Fabricate is absent or its handshake fails, the
  engine runs as the pure Phase 3 numeric economy; Fabricate rules simply
  no-op (logged).
- **API drift:** the adapter resolves Fabricate methods (`startGatheringAttempt`,
  `craft`, `getInventory`, …) by name at call time across `game.fabricate` and its
  `api`, and degrades to a logged no-op when a method is missing. This is the one
  place to touch when upstream settles — see `dependency-strategy` notes and
  [fabricate#345](https://github.com/mistersilver-uk/fabricate/issues/345).
- **Per-tick op cap:** harvests/crafts are capped at `MAX_FAB_OPS_PER_RULE`
  (1000) per rule per tick; any remainder lands on the next tick (logged).
- **Within-tick latency:** crafts are capped by the stockpile as it stood at the
  start of the tick, so ingredients harvested *this* tick feed crafts on the
  *next* one.

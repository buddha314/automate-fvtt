# Fabricate integration (Phase 4)

Automate FVTT backs the Keep economy with [Fabricate](https://github.com/mistersilver-uk/fabricate)
instead of bespoke math: resource nodes auto-deposit their yield on time advance,
and recipes run as Keep converters (ore → ingot). Everything goes through the
single seam in `scripts/fabricate-adapter.js`.

**We defer to Fabricate's surface.** Fabricate owns the crafting/gathering domain;
we adapt to whatever it exposes rather than asking it to fit our model. Fabricate
is pre-1.0 and **explicitly disclaims backwards compatibility** ("Before the first
stable release, backwards compatibility is not guaranteed"), so the seam's job is
to absorb that drift — both method churn *and* the non-deterministic, check-driven
outcomes described below.

## What is actually public

Only two things are documented as a stable outward contract for third-party
modules; the rest we use are *de-facto* internal surfaces that we wrap and treat
as drift-prone:

| Surface | Stability | We use it for |
|---|---|---|
| `game.fabricate.gathering.*` namespace | **documented public** | conditions, realm/party helpers |
| `game.fabricate.api.HOOKS.gathering.*` hooks | **documented public** | reading gathering outcomes (the deposit signal) |
| `game.fabricate.startGatheringAttempt(opts)` | de-facto | starting a harvest |
| `game.fabricate.craft(actor, recipe, opts)` | de-facto | running a recipe |
| `game.fabricate.exportSystem(id)` / `importSystemFromFile(json, opts)` | de-facto | seeding a system |
| actor `Item`s matched by `sourceItemUuid` | de-facto | reading the component inventory |

The integrations spec is *inward*-facing (how Fabricate consumes Item Piles /
Simple Calendar), so there is no promised outward API beyond `gathering.*` and the
published hooks. Keep every other call name and payload shape isolated to the
adapter.

## How it fits the rules engine

The Phase 3 engine stays unchanged and **pure**. A Fabricate-backed rule carries
empty numeric `inputs`/`outputs`, so `computeTickPlan` still counts *how many
times* it fires over an elapsed span (its `applications` entry) but makes no
numeric delta. The engine then:

1. writes the numeric/port deltas for ordinary rules (Phase 3 behaviour);
2. asks `planFabricateOps` how many harvests/crafts to *request*, capped by
   ingredients on hand for crafts;
3. runs those ops through the adapter against the Keep actor;
4. projects the resulting components back into `system.stockpile`, so Items become
   visible to the sheet and downstream rules.

Writes happen on the single authoritative GM (same guard as Phase 3), so a
multi-client world applies each tick once.

> **Outcomes are no longer guaranteed.** A harvest or craft is now a *request*,
> not a deposit. Fabricate resolves both through roll/check logic that can **fail
> and produce zero items** (see "Resolution modes & checks"). Step 2 plans how
> many attempts to make; step 4 reflects whatever actually landed.

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

**There is no `getInventory` API.** Components are plain Foundry `Item`s on the
actor. To read the inventory the adapter scans `actor.items` and matches each item
to a managed `Component` by source reference — `item.uuid`,
`item._stats?.compendiumSource`, or the legacy `item.flags?.core?.sourceId`,
compared against the component's `sourceItemUuid`. Quantity comes from the item's
own count. `projectInventory` consumes that scanned `{ componentId → count }` map.

> **Faster path for harvests:** the `attemptCompleted` hook payload (below) carries
> the freshly-`gatheredItems` *with their `componentId`*, so a harvest deposit can
> be applied as a delta from the hook alone, without re-scanning the whole
> inventory. Use the full scan as the authoritative reconcile (e.g. after a craft
> consumes ingredients).

**Ownership invariant:** a resource key is governed by *either* numeric rules
*or* Fabricate — never both. A managed key is overwritten wholesale on each sync,
so a numeric producer pointing at the same key would be clobbered. Keep the two
sets disjoint.

## Authoring Fabricate-backed rules

```js
const api = game.modules.get("automate-fvtt").api;

// Map Fabricate components to ledger resources (by the component's id).
api.rules.setComponentMap([
  { componentId: "fab.iron-ore",   resourceKey: "ore"   },
  { componentId: "fab.iron-ingot", resourceKey: "ingot" },
]);

// Auto-gather from a Fabricate environment/task. The Keep is the gatherer.
// environmentId + taskId is still the entry point. Whether the yield lands now
// or later depends on the task (see "Immediate vs timed"), and whether it lands
// AT ALL depends on the task's resolution mode / check (see below).
api.rules.register(api.rules.makeFabricateRule({
  id: "river-fishing",
  intervalSeconds: 86400,
  fabricate: { op: api.rules.FAB_OP.HARVEST, environmentId: "env.river", taskId: "task.fish" },
}));

// Run a smelting recipe hourly, requested up to the ore on hand.
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

## Resolution modes & checks (why outcomes vary)

Both gathering and crafting now resolve through a **resolution mode**, and most
modes run an engine-rolled check. The engine rolls the configured formula itself —
no player has to be present — but the *result* is no longer deterministic.

- **Crafting modes:** `simple` | `routed` | `progressive` | `alchemy`.
  - `simple` — pass/fail vs a DC, and the check can be **disabled**
    (`craftingCheck.enabled = false`) for fully deterministic crafting.
  - `routed` / `progressive` — a check is **required** and **cannot be disabled**;
    the rolled outcome selects which result group is produced (routed) or how much
    is produced (progressive), and can fail to nothing.
- **Gathering modes:** `progressive` | `routed` | `d100` (a different set than
  crafting). `routed` needs a *system-level* formula
  (`system.gatheringCraftingCheck.routed.rollFormula`, DC defaults to 15); a
  routed task with no formula **does not resolve** and returns a GM-fix
  diagnostic. `d100` rolls per drop row, no DC.

**Design choice for the Keep economy:** author our seeded conversion recipes in
**`simple` mode with the check disabled** so ore→ingot is deterministic. Reserve
the stochastic modes for content where variable yield is intended. Either way the
adapter must read the outcome and never assume success.

Other craft-time gates the adapter must tolerate:

- **Knowledge / visibility gating.** Recipes can be hidden until learned. A craft
  run as a **non-GM** actor is subject to the full visibility/knowledge guard (the
  Keep must have learned the recipe or own the matching recipe-item). Running as
  **GM bypasses** all gating. *Decision:* the Keep automation crafts under the
  primary-GM context (the same authoritative client that owns the tick), so seeded
  recipes need no per-Keep learning — but that also means we don't get realistic
  recipe-item consumption for free.
- **Incomplete "shell" recipes.** A recipe existing does not mean it is craftable;
  `craft()` rejects a structurally-incomplete shell. Seed only complete recipes.
- **Tools replaced catalysts.** Required, breakable prerequisites now live in a
  system-owned `system.tools` library referenced by `toolIds`. If our seed JSON
  ever used catalysts, Fabricate's migration has converted them to tools.

## Providing recipes & nodes (seeding a crafting system)

Rather than hand-build recipes/components/nodes in every world, the module can
**seed a whole crafting system into Fabricate** from a JSON file it ships.
`game.fabricate.exportSystem(id)` produces an envelope —
`{ fabricateVersion, exportedAt, system, recipes }` — and
`game.fabricate.importSystemFromFile` reads it back (it accepts a **raw JSON
string**, so no file picker is needed). The adapter wraps this:

```js
const api = game.modules.get("automate-fvtt").api.fabricate;
await api.seedSystem("modules/automate-fvtt/data/fabricate/keep-economy.json");
// also: api.exportSystem(id), api.importSystem(jsonOrData, opts),
//       api.getSystem(id), api.listSystems()
```

The envelope shape is **undocumented** (the data-models spec defines *storage*,
not a file wrapper) — Fabricate persists `fabricate.craftingSystems` and
`fabricate.recipes` as separate settings and links them by `Recipe.craftingSystemId`.
Treat the envelope as drift-prone and re-export from a current Fabricate whenever
authoring a new seed. Note the canonical field renames Fabricate now uses (and
strips legacy aliases on import/export): `managedItems → components`,
`systemItemId → componentId`, `match.type "systemItem" → "component"`,
`sourceUuid → sourceItemUuid`, `gatheringRegions → gatheringRealms`.

Workflow: build the system once in Fabricate's UI → **Export System** → drop the
JSON in `data/fabricate/` → list it in `FABRICATE.SEED_SYSTEMS`
(`scripts/constants.js`). On `ready` the **primary GM** seeds each entry,
**idempotently** — a system whose id already exists is skipped, so reloads never
duplicate (`{ overwriteExisting: true }` forces a refresh). See
`data/fabricate/README.md`.

Two artifacts, two pipelines:

| Content | Ships as |
|---|---|
| Essences, components, recipes, tools, gathering checks | the Fabricate system **export JSON** (`importSystemFromFile`) |
| Gathering environments / tasks | **separate** Fabricate settings — **excluded** from system export; seed via their own path |
| Resource-**node placements** on a map | a **Scene compendium pack** (node data lives on Scene tiles) |

## Reading outcomes: subscribe to the hook, don't poll worldTime

A harvest resolves one of two ways:

- **Immediate** (task has no `timeRequirement`): resolved synchronously *inside*
  the `startGatheringAttempt` call. It never touches `updateWorldTime`, so a
  worldTime-polling deposit loop would **miss it entirely**.
- **Timed** (task declares a `timeRequirement`): creates an active run that
  Fabricate matures on its own `updateWorldTime` processing (which our tick
  advances). The completion publishes once, on the primary GM.

To cover both, the adapter subscribes to the public hook
**`fabricate.gathering.attemptCompleted`** (constant
`game.fabricate.api.HOOKS.gathering.ATTEMPT_COMPLETED`). It fires exactly once per
terminal attempt — immediate or matured — with a normalized payload:

```text
{ schemaVersion, status: 'succeeded' | 'failed',
  actorId, actorUuid, actorName,
  environmentId, taskId, runId, runStatus,
  gatheredItems: [{ actorUuid, itemUuid, componentId, … }],
  usedTools, events, checkResult }
```

`status` tells us whether anything was produced; `gatheredItems[].componentId`
maps straight through `component-map.js` into the stockpile delta. (Crafts resolve
synchronously from the `craft()` call, so they don't need the hook — read the
returned result and reconcile via the inventory scan.)

## Notes & limits

- **Crafting is live.** The previous "only Gathering is implemented; model
  crafting with numeric converter rules" workaround is **retired** — drive
  Fabricate's real recipe/step + tools + check engine. Numeric converter rules
  remain available for economies that don't want a Fabricate dependency.
- **Degrades cleanly:** when Fabricate is absent or its handshake fails, the
  engine runs as the pure Phase 3 numeric economy; Fabricate rules simply
  no-op (logged).
- **API drift:** the adapter resolves Fabricate methods (`startGatheringAttempt`,
  `craft`, `exportSystem`, `importSystemFromFile`, …) by name at call time across
  `game.fabricate` and its `api`, and degrades to a logged no-op when a method is
  missing. This is the one place to touch when upstream settles — see
  `dependency-strategy` notes and
  [fabricate#345](https://github.com/mistersilver-uk/fabricate/issues/345).
- **Migration resilience:** Fabricate runs a versioned migration framework that can
  **rewrite or delete** our seeded systems/recipes (e.g. a resolution-mode change
  migrates recipes and may drop ones it can't fit) and cleans up in-progress runs
  and learned-recipe entries. Stored recipe/system **ids can be invalidated
  underneath us** — seeding must reconcile against what's present, not assume our
  ids survived.
- **Per-tick op cap:** harvests/crafts are capped at `MAX_FAB_OPS_PER_RULE`
  (1000) per rule per tick; any remainder lands on the next tick (logged).
- **Within-tick latency:** crafts are capped by the stockpile as it stood at the
  start of the tick, so ingredients harvested *this* tick feed crafts on the
  *next* one.

# data/fabricate/

Crafting-system **export JSONs** this module seeds into Fabricate on load.

## Workflow
1. In Foundry, open Fabricate and build the crafting system (essences,
   item-backed components, recipes, gathering realms/tasks).
2. Fabricate → **Export System** → save the JSON here, e.g. `keep-economy.json`.
   The file is Fabricate's envelope: `{ fabricateVersion, exportedAt, system, recipes }`.
3. List it in `FABRICATE.SEED_SYSTEMS` in `scripts/constants.js`, e.g.
   `SEED_SYSTEMS: ["data/fabricate/keep-economy.json"]`.

On the next `ready`, the **primary GM** seeds it via
`game.fabricate.importSystemFromFile` (wrapped by `fabricate-adapter.js`'s
`seedSystem`). It's **idempotent**: a system whose id already exists is skipped,
so re-loading never duplicates. Pass `{ overwriteExisting: true }` to
`api.fabricate.seedSystem(url, …)` to force a refresh.

## Notes
- **Recipes, components, essences, and gathering realms** travel in this JSON.
- **Resource-node *placements* on a map** live on the Scene/tiles, not here —
  ship those in a Scene compendium pack (see the bandits-on-the-river content).
- Manual API (from a macro): `game.modules.get("automate-fvtt").api.fabricate`
  exposes `seedSystem`, `exportSystem`, `importSystem`, `getSystem`, `listSystems`.

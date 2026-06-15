# automate-fvtt
A Foundry VTT plugin to offer automated or calendared crafting for simulation games. "Factorio on Foundry"

My intention is to build this module backwards from a module. This should allow me to focus on what will be useful in game play. Currently, I am developing a Pathfinder module in parallel called [Bandits On The River](https://github.com/buddha314/bandits-on-the-river). Pathfinder 2E has open source rules and a sense of crafting, so that system makes for a good test bed.

This approach also allows Automate to work from gameplay backwards to the Fabricate module, reducing overlap.

## Module scaffold
This repository contains the Foundry VTT module scaffold and the Phase 0 foundation:

- `module.json` manifest for Foundry module registration
- `scripts/module.js` entry point — wires `init`/`ready`, publishes the API
- `scripts/constants.js` ids, settings keys, hooks, Fabricate constants
- `scripts/logger.js` structured, debug-gated logger
- `scripts/settings.js` settings registration
- `scripts/fabricate-adapter.js` **the single seam over Fabricate** — detect, acquire, version-check
- `scripts/types.js` shared JSDoc typedefs (Keep, Stockpile, Rule, Asset, Port, AdjacencyEdge)
- `scripts/data/keep-model.js` Keep actor sub-type data model (stockpile + counts)
- `scripts/apps/keep-sheet.js` minimal Keep sheet (ApplicationV2)
- `scripts/keep-api.js` Keep CRUD API, published at `game.modules.get("automate-fvtt").api.keeps`
- `templates/keep-sheet.hbs` Keep sheet template
- `styles/module.css` base stylesheet
- `lang/en.json` English localization file

### Architecture note (Phase 0)
This module is built **on top of [Fabricate](https://github.com/mistersilver-uk/fabricate)**. All
interaction with Fabricate goes through `FabricateAdapter` so that Fabricate's pre-1.0 API drift is
isolated to one file. The handshake runs at `ready` (Fabricate publishes `game.fabricate.api` during
its own `init`); if Fabricate is missing or incompatible the module warns the GM and stays inert
rather than throwing. The public API is exposed at `game.modules.get("automate-fvtt").api`.

### Keeps (Phase 1)
A **Keep** is a custom Actor sub-type (`automate-fvtt.keep`) that owns a resource **stockpile**
(`resource → qty`) and **count** scalars (henchmen, garden) which drive the count-based economy rules
in Phase 3. Create and edit via the sheet, or the API:

```js
const api = game.modules.get("automate-fvtt").api.keeps;
const keep = await api.create({ name: "Castle Greyhawk", counts: { henchmen: 2, garden: 3 } });
await api.setResource(keep, "rations", 5);
keep.sheet.render(true);
```

### Time engine & GM controls (Phase 2)
A single **tick dispatcher** listens to Foundry's `updateWorldTime` hook and fans the delta out
to subscribers (`api.time.onTick(id, cb)`), then emits the `automate-fvtt.tick` hook — the one
integration point the Phase 3 economy rules hang off. Interval math is deterministic and
large-jump-safe: advancing a year in one step fires the same number of intervals as 365 daily
steps.

GMs drive time from the **Time Controls** panel (auto-opens for the GM; also a scene-control
button, or `game.modules.get("automate-fvtt").api.time.open()`): a configurable **Next** button,
preset jumps (+hour/day/week/month/year, Shift-click to rewind), and a custom amount/unit advance —
all via `game.time.advance()`.

## Local development setup
1. Create a link from this repository to your Foundry data modules folder:
   - Linux/macOS:
     ```bash
     ln -s "$(pwd)" ~/.local/share/FoundryVTT/Data/modules/automate-fvtt
     ```
   - Windows (PowerShell as Administrator):
     ```powershell
     New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\AppData\Local\FoundryVTT\Data\modules\automate-fvtt" -Target ((Get-Location).Path)
     ```
2. Restart Foundry VTT and enable **Automate FVTT** in your world.

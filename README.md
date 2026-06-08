# automate-fvtt
A Foundry VTT plugin to offer automated or calendared crafting for simulation games. "Factorio on Foundry"

## Module scaffold
This repository contains the Foundry VTT module scaffold and the Phase 0 foundation:

- `module.json` manifest for Foundry module registration
- `scripts/module.js` entry point — wires `init`/`ready`, publishes the API
- `scripts/constants.js` ids, settings keys, hooks, Fabricate constants
- `scripts/logger.js` structured, debug-gated logger
- `scripts/settings.js` settings registration
- `scripts/fabricate-adapter.js` **the single seam over Fabricate** — detect, acquire, version-check
- `scripts/types.js` shared JSDoc typedefs (Keep, Stockpile, Rule, Asset, Port, AdjacencyEdge)
- `styles/module.css` base stylesheet
- `lang/en.json` English localization file

### Architecture note (Phase 0)
This module is built **on top of [Fabricate](https://github.com/mistersilver-uk/fabricate)**. All
interaction with Fabricate goes through `FabricateAdapter` so that Fabricate's pre-1.0 API drift is
isolated to one file. The handshake runs at `ready` (Fabricate publishes `game.fabricate.api` during
its own `init`); if Fabricate is missing or incompatible the module warns the GM and stays inert
rather than throwing. The public API is exposed at `game.modules.get("automate-fvtt").api`.

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

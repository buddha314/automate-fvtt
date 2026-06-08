# automate-fvtt
A Foundry VTT plugin to offer automated or calendared crafting for simulation games. "Factorio on Foundry"

## Module scaffold
This repository now contains the basic Foundry VTT module scaffold:

- `module.json` manifest for Foundry module registration
- `scripts/module.js` module entry point
- `styles/module.css` base stylesheet
- `lang/en.json` English localization file

## Local development setup
1. Create a link from this repository to your Foundry data modules folder:
   - Linux/macOS:
     ```bash
     ln -s "$(pwd)" ~/.local/share/FoundryVTT/Data/modules/automate-fvtt
     ```
   - Windows (PowerShell as Administrator):
     ```powershell
     New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\AppData\Local\FoundryVTT\Data\modules\automate-fvtt" -Target "C:\absolute\path\to\automate-fvtt"
     ```
   - Replace the Windows target path with your repository path (or use `(Get-Location).Path` from the repo directory).
2. Restart Foundry VTT and enable **Automate FVTT** in your world.

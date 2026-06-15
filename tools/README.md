# tools/

Developer tooling for working on Automate FVTT locally. **Not loaded by Foundry**
— Foundry only loads `scripts/` (the ES modules in `module.json`). These are
helper scripts you run from a shell.

## `sync-fabricate.sh`

Installs the **newest Fabricate build** into your local Foundry. Automate FVTT
hard-depends on Fabricate, which ships almost daily as GitHub *prereleases*
(`1.0.0-rc.N`). Foundry's in-app updater and the `releases/latest/...` manifest
URL both skip prereleases, so they get stuck on an old build — this pulls the
most recent release of any kind and swaps it in, backing up the previous install
under `<foundrydata>/_module-backups/`.

```bash
tools/sync-fabricate.sh                       # auto-detect data path, latest RC
tools/sync-fabricate.sh --tag v1.0.0-rc.80    # pin a specific tag
FOUNDRY_DATA=/path/to/foundrydata tools/sync-fabricate.sh
```

Requires `gh` (authenticated) and `unzip`. The Foundry data path is found from
`$FOUNDRY_DATA`, else the `--dataPath` of a running Foundry process, else common
defaults. After it runs, reload your world (or restart Foundry) to load the build.

> Pin reminder: after verifying a new RC works, bump `FABRICATE.KNOWN_GOOD_VERSION`
> in `scripts/constants.js`. The adapter only warns on mismatch, it doesn't fail.

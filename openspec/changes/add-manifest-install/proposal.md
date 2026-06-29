# Make the Module Installable from Manifest

## Why

Users install a Foundry module by pasting its **manifest URL** (`module.json`) into
Foundry's "Install Module" dialog; Foundry then reads `download` to fetch the
`module.zip`. We need this to be reliable, documented, and verified on every
release — it is the primary distribution path.

**Current state (verified 2026-06-29):** this already works. `release.yml` published
`v0.1.0` with both `module.json` and `module.zip` assets, and the
`releases/latest/download/{module.json,module.zip}` URLs return HTTP 200. So this
change **formalizes, verifies, and hardens** an existing capability rather than
building it from scratch — and closes the gap that it was untracked.

## What Changes

- **Codify the manifest-install requirement** as a spec: a published release carries
  `module.json` + `module.zip`; `module.json` `manifest`/`download` resolve to the
  install assets; `version` matches the release tag and the in-zip manifest.
- **Verify-on-release**: a release-time check (or documented manual step) that the
  manifest URL installs cleanly and the version is consistent end-to-end.
- **Document the install path** in `README.md` (paste-this-manifest-URL).
- **Optionally** list the package on the **Foundry package registry** so it is
  discoverable in-app by name (not just by manifest URL) — deferred/decision.

## Impact

- **Specs:** new `manifest-install` capability.
- **Code/CI:** `.github/workflows/release.yml` (asset publishing already present;
  add a manifest-resolves/version-consistency check), `module.json` (manifest/
  download/version fields), `README.md` install section.
- **Depends on:** the existing release workflow (#31) and the `v0.1.0` release.

## Non-goals

- A non-GitHub distribution channel (paid stores, other registries) beyond the
  optional Foundry package listing.
- Auto-update/versioning policy beyond "tag ⇄ manifest version consistency."
- Changing module functionality — this is packaging/distribution only.

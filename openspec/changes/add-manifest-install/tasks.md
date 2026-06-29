# Tasks — Make the Module Installable from Manifest

## 1. Confirm current state
- [x] 1.1 Verify `release.yml` exists and `v0.1.0` is published with `module.json` +
  `module.zip` assets (confirmed 2026-06-29).
- [x] 1.2 Verify `releases/latest/download/{module.json,module.zip}` return HTTP 200
  (confirmed 2026-06-29).
- [x] 1.3 Verify `module.json` `manifest`/`download` use the stable latest-download
  URLs and a `compatibility` range is set (confirmed 2026-06-29).

## 2. Version-consistency guarantee
- [ ] 2.1 Enforce/verify that the git tag, committed `module.json` `version`, and the
  in-zip `module.json` `version` all match (workflow check preferred).
- [ ] 2.2 Fail the release (or flag) on mismatch.

## 3. Post-release verification
- [ ] 3.1 Add a post-release check that `releases/latest/download/module.json`
  returns 200, parses, and its `version` equals the tag (CI step or release checklist).

## 4. Documentation
- [ ] 4.1 Add an "Install" section to `README.md` with the manifest URL and steps.

## 5. Optional / deferred
- [ ] 5.1 Decide on a Foundry package-registry listing (installable by name + in-app
  updater) — separate submission process.
- [ ] 5.2 Decide whether to also publish per-version manifests for pinned installs.

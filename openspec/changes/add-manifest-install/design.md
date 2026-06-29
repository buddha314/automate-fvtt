# Design — Make the Module Installable from Manifest

## Context

Foundry installs a module from a **manifest URL** pointing at a `module.json`; that
manifest's `download` field gives the `module.zip`. The convention this repo already
uses is GitHub Releases with the stable `releases/latest/download/<asset>` URLs, so
the manifest URL never changes across versions.

## Current state (verified 2026-06-29)

- `module.json` → `manifest: …/releases/latest/download/module.json`,
  `download: …/releases/latest/download/module.zip`, `version: 0.1.0`,
  `compatibility: { minimum: 13, verified: 14 }`.
- `release.yml` workflow exists; release **`v0.1.0`** is published with assets
  **`module.json`** and **`module.zip`**.
- Both `releases/latest/download/{module.json,module.zip}` return **HTTP 200**.

**Conclusion:** install-from-manifest is functional today. The remaining work is
correctness guarantees, verification, and docs — not new machinery.

## Decision 1 — Stable `latest/download` manifest is the canonical install URL

Keep the `releases/latest/download/module.json` URL as the one users paste. It is
version-independent (always resolves to the newest release's assets), so README and
external references never go stale. The release-asset `module.json` is what Foundry
reads, so its `manifest`/`download` must point back at these same stable URLs (they
do).

## Decision 2 — Version consistency is the invariant to protect

The failure mode for manifest installs is drift between:
the **git tag**, the **`version`** in the committed `module.json`, and the
**`version`** in the **released (in-zip) `module.json`**. These must match for
Foundry to install and later detect updates correctly. The release process SHALL
enforce/verify this (workflow check preferred; documented manual step otherwise).

## Decision 3 — Verify the manifest actually resolves on each release

A lightweight post-release check (or manual checklist) that
`releases/latest/download/module.json` returns 200, parses, and its `version`
equals the tag. Cheap insurance against a broken upload silently shipping an
uninstallable "latest."

## Decision 4 — Foundry package registry listing is optional (deferred)

Listing on Foundry's package registry makes the module installable **by name**
in-app (and eligible for the in-app updater) rather than only by manifest URL.
Valuable but separate from manifest-install correctness; defer as a decision (it
has its own submission process and review).

## Open questions

- Workflow-enforced version check vs a documented manual release checklist.
- Whether to pursue the Foundry package-registry listing now or later.
- Whether to also publish a per-version manifest (`download/<tag>/module.json`) in
  addition to `latest`, for pinned installs.

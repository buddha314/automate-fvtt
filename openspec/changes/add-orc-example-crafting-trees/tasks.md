# Tasks — Add ORC Example Crafting Trees (Pathfinder 2e & Starfinder 2e)

## 1. Legal determination (the gate)
- [x] 1.1 Confirm licensing — both PF2e (Remaster) and SF2e rules + mechanical stat
  lines are **ORC Licensed Material**, reusable with the ORC NOTICE (verified
  2026-06-29; sources in `design.md`). **Verdict: reuse of crafting mechanics is allowed.**
- [x] 1.2 Identify **Reserved Material to exclude** — Paizo trademarks/logos, setting
  lore/flavor, distinctive (Product Identity) names, art/maps; no implied endorsement.
- [x] 1.3 Owner decision recorded — **agreed to build on ORC mechanics** (2026-06-29).
  Formal counsel/Paizo-licensing review still recommended before any commercial release.

## 2. Source & delivery decision
- [x] 2.1 Reject AoN scraping and reshipping game-system packs (design Decision 3).
- [x] 2.2 Shipped example trees = **Option B** (system-agnostic ORC-derived seeds).
- [x] 2.3 Full breadth = **import from content the user already owns** (Decision 6),
  not redistributed by us. Define the provenance/legal split per source.

## 3. Pluggable tree-source import mechanism (Decision 6)
- [ ] 3.1 Define a `TreeSource` interface: `id`, `provenance` (`shipped |
  fabricate-library | installed-system | module | user-export`), `isAvailable()`,
  `load()` → a Fabricate seed/system.
- [ ] 3.2 **`shipped` source (now):** load a bundled ORC-derived seed JSON; carries the NOTICE.
- [ ] 3.3 **`fabricate-library` source (near-term):** seed an existing Fabricate
  crafting-system export directly (already in envelope format); honor its upstream license.
- [ ] 3.4 **`installed-system` source (deferred):** map the active world's `pf2e`/`sf2e`
  system compendia at runtime → full tree; **no redistribution** (user owns it).
- [ ] 3.5 **`module` / source-rule-package source (deferred):** map a separately
  installed/purchased content module's packs via its public API; **no redistribution**.
- [ ] 3.6 **`user-export` source (deferred):** import a user-supplied Fabricate export
  / file the user is licensed to use.
- [ ] 3.7 Provenance guard: we may redistribute `shipped` (ORC + NOTICE) and
  `fabricate-library` content only as its upstream license allows; owned-content
  sources are transformed locally and never re-exported.

## 4. Registry, toggles & ORC NOTICE
- [ ] 4.1 Example-tree registry + per-tree setting (default **off**), seeding enabled
  trees idempotently via the #36 `seedSystem` pipeline.
- [ ] 4.2 Ship a conformant ORC NOTICE file (Attribution + Reserved Material + upstream
  ORC notice per source) and surface it in-app per shipped tree.

## 5. Author the shipped example trees (ORC-derived, mechanics only)
- [ ] 5.1 PF2e tree (Remaster source) — narrow: a few materials + converter recipes.
- [ ] 5.2 SF2e tree (released ruleset) — narrow: a few materials + converter recipes.
- [ ] 5.3 Product-Identity name guard (allow-list / heuristic) applied to both.
- [ ] 5.4 Wire `component-map.js` so each tree's components project into the stockpile.

## 6. Tests & docs
- [ ] 6.1 Unit tests: seed validity, Reserved-Material exclusion (no lore/PI), per-tree
  toggle on/off.
- [ ] 6.2 `TreeSource` tests: `shipped` loads; owned-content sources mocked present/absent;
  provenance guard blocks redistribution of non-`shipped` content.
- [ ] 6.3 Live: enable each tree in the running world, confirm it seeds + projects.
- [ ] 6.4 Docs: ORC basis, excluded Reserved Material, and the delivery model
  (shipped examples vs build-on-Fabricate-library vs import-from-owned-content) in `docs/`.

## 7. Contribute back to the Fabricate library (deferred)
- [ ] 7.1 Export workflow over `exportSystem` (#36) that emits a contributable tree.
- [ ] 7.2 Contribution guard — export only `shipped`/original provenance; refuse
  owned-content output and Reserved Material; preserve the ORC NOTICE in the export.
- [ ] 7.3 Follow the Fabricate library/repo's contribution terms for submissions.

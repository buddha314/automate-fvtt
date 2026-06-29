# Add ORC Example Crafting Trees (Pathfinder 2e & Starfinder 2e)

## Why

The Keep economy runs real Fabricate crafting (the seeded "Keep Economy" system),
but ships only placeholder components/recipes. We want to give players **ready-made
example crafting trees** they can opt into — and to show the engine is
system-agnostic by offering **two** flavors: a **Pathfinder 2e** tree and a
**Starfinder 2e** tree, each an independent, optional example.

Both Pathfinder 2e (Remaster) and Starfinder 2e publish their rules under Paizo's
**ORC License**, so their crafting *mechanics and item stat lines* are reusable.
The project owner has agreed to build on ORC mechanics. This change scopes shipping
those example trees compliantly.

## What Changes

- **Ship one or more optional ORC-derived example crafting-system seeds per family**
  — a **PF2e** tree and an **SF2e** tree — each toggled on/off independently
  (default off), seeded through the existing Fabricate seed pipeline.
- Each tree reuses **only ORC Licensed Material** (crafting rules + mechanical item
  stats) and **excludes Reserved Material** — the "Pathfinder"/"Starfinder"
  trademarks and logos, setting lore/flavor, distinctive (Product-Identity) names,
  and art — with no implied Paizo endorsement.
- **Ship the ORC NOTICE** (attribution + the upstream ORC notice block per source
  book) alongside the reshipped Licensed Material, surfaced in-app.
- The trees are **system-agnostic Fabricate seeds** (components reference our own
  shipped item uuids, not a game system's compendium), so a PF2e *or* SF2e *or* any
  other world can enable either tree — sidestepping Foundry's one-system-per-world
  limit.
- An **example-tree registry + per-tree feature toggle**, so users pick which
  examples to load, and trees stay clearly separated from a campaign's real economy.
- A **pluggable tree-source import mechanism** (interface defined now, most
  providers deferred) so delivery is multi-tier:
  - we **ship curated ORC example trees directly** (`shipped`);
  - we **build on existing Fabricate-library crafting systems** (`fabricate-library`,
    already in Fabricate's export format) honoring each entry's upstream license;
  - the **full** tree is **imported from content the user already owns**
    (`installed-system` / `module` / `user-export`) and mapped locally — never
    redistributed by us.
- A **contribute-back path** (deferred): export our own ORC-derived trees (NOTICE
  preserved) to the Fabricate library, gated so only content we're licensed to share
  can be contributed.

## Impact

- **Specs:** new `orc-example-crafting-trees` capability.
- **Code:** a small registry of shipped example seeds (`data/fabricate/<tree>.json`)
  with per-tree toggles in `scripts/constants.js`/settings; reuse
  `fabricate-adapter.js` `seedSystem` + the component→resource map. An ORC NOTICE
  asset and an in-app surface.
- **Depends on:** the Fabricate seed/import + component-map pipeline (landed in #36).
- **Gated on:** authoring each tree's ORC-derived content (mechanics only) with the
  PI-name exclusion pass; a recommended legal review before any commercial release.

## Non-goals

- Redistributing the Foundry `pf2e` / `sf2e` *system* compendia, or scraping
  Archives of Nethys — content is independently ORC-derived (mechanics only).
- Using the "Pathfinder"/"Starfinder" trademarks to brand the module or implying
  endorsement; shipping setting lore, distinctive (PI) names, or art.
- Authoring Fabricate's crafting *engine* (that lives in Fabricate) — this change
  only supplies optional example content for it.
- A complete port of either system's item catalog — start with small, representative
  trees; breadth is later, incremental content work.

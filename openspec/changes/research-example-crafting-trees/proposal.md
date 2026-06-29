# Research Other Crafting Trees to Ship as Examples

## Why

We are shipping PF2e + SF2e example crafting trees (#38) under the ORC License. But
those are two points in a much larger space — other game systems and community
sources have crafting content under reuse-friendly licenses we could also offer as
example trees, broadening appeal and showing the engine is system-agnostic.

Before authoring more trees we should **research the candidate landscape** — what's
out there, under what license, from what source, and how well it fits the Keep
economy — so the examples program is driven by a vetted shortlist rather than ad-hoc
picks. License compatibility is the gating filter (the recurring theme across #36–#39).

## What Changes

- A **standing candidate catalog** of crafting-tree sources, each evaluated on:
  **license** (reusability), **source/provenance** (shipped / fabricate-library /
  installed-system / user-export), **breadth & fit** for the Keep economy, and
  **effort**.
- A **license-first, tiered evaluation process**: CC-BY, ORC, permissive,
  public-domain, and original work are **first-class**; **OGL 1.0a is allowed but
  opt-in and labeled** (we take both license families, each behind its own per-tree
  notice, kept isolated); proprietary / Reserved-Material-only sources are rejected.
- A **ranked shortlist** with, per pick, a recommended `provenance` and license
  posture — feeding the examples program (#38) and reusing its `TreeSource` model.
- A **re-evaluation trigger** so the catalog stays current as licenses/sources change.

This change is **research/spec only** — it defines what the research must produce and
the constraints; authoring any chosen tree happens under #38.

## Impact

- **Specs:** new `example-tree-candidates` capability (the research process + outputs).
- **Docs:** the candidate catalog + shortlist live in this change's `design.md`
  (seeded here) and graduate into `docs/` when acted on.
- **Depends on:** the examples program (#38) for the `TreeSource`/provenance model and
  the ORC/legal framing; the Fabricate seed pipeline (#36).

## Non-goals

- Authoring or importing any new tree (that is #38's implementation).
- Final legal clearance of a candidate — the catalog records license findings for
  review, not a sign-off; counsel review still applies before shipping.
- Re-deciding PF2e/SF2e (already scoped in #38); this is about *other* trees.

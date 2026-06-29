# Design — Add ORC Example Crafting Trees (Pathfinder 2e & Starfinder 2e)

## Context

`automate-fvtt` backs its Keep economy with Fabricate, and (since #36) can seed a
crafting system from JSON and project an actor's components into the Keep stockpile.
We want to ship **optional example crafting trees** for two Paizo families —
**Pathfinder 2e** and **Starfinder 2e** — that players can enable independently.
The first question is legal, not technical, so this design leads with the licensing
determination and then the shipping mechanism.

> **Disclaimer:** This is an engineering due-diligence summary, **not legal
> advice.** It cites Paizo's public licensing terms as of 2026-06. The project owner
> has agreed to build on ORC mechanics; for any **commercial** release a qualified
> counsel / Paizo-licensing review is still recommended.

## Decision 1 — PF2e (Remaster) and SF2e rules & item stats are reusable under ORC

**Verdict: yes, conditionally — for both families.** Paizo releases Pathfinder 2e
(Remaster) and Starfinder 2e rules content under the **ORC License (Open RPG
Creative License)**. The ORC distinguishes:

- **Licensed Material** — "statblocks, game rules, character attributes, and the
  methods and systems inherent in playing the game" — copyrighted *expressions of
  game mechanics*. **Reusable**, including commercially, **with the ORC NOTICE.**
- **Reserved Material** — trademarks, world lore, story arcs, distinctive
  characters, locations, organizations, deities, events, **art and maps**. **Not**
  reusable.

So **crafting rules and the mechanical stat lines of items/materials are Licensed
Material we may reuse** for both trees. We exclude the **"Pathfinder"/"Starfinder"
trademarks/logos**, **lore/flavor text**, **distinctive (Product-Identity) item
names**, and **art**. Generic mechanical names are generally fine; IP/setting names
are not — a judgment pass, not a blind dump.

**PF2e caveat:** only the **Remaster** PF2e content is ORC. Pre-Remaster PF2e was
OGL/Open Game Content (a different license). Source the PF2e tree from **Remaster
(ORC)** material so the whole change rests on one license. SF2e is ORC throughout
(confirm released ruleset, not the earlier ORC *playtest*).

Sources:
- Paizo — Licenses overview: https://paizo.com/licenses
- Paizo — ORC License: https://paizo.com/orclicense (full text
  https://downloads.paizo.com/ORC_LicenseFINAL.pdf ; "ORC AxE"
  https://downloads.paizo.com/ORC_AxE_FINAL.pdf)
- "A Basic Guide to Using ORC" (EN World):
  https://www.enworld.org/threads/a-basic-guide-to-using-orc-open-rpg-creative-license.697078/
- Example downstream ORC notice (d20pfsrd): https://pf2orc.d20pfsrd.com/rules/legal-notice/

## Decision 2 — Ship the ORC NOTICE with each reshipped tree

These trees are **reshipped** Licensed Material (Decision 3), so each requires a
conformant ORC NOTICE:

1. **Attribution Notice** — how we wish to be credited for our contribution.
2. **Reserved Material Notice** — good-faith identification of any of *our own*
   Reserved Material in the work.
3. **ORC Notice block** — credits the upstream licensors (Paizo's published ORC
   notice for each source book) and chains attribution downstream.

Ship a `LICENSE-ORC`/`NOTICE` file plus per-tree source attribution, and surface it
in-app (an about line / the tree's description). Never use Paizo trademarks or imply
endorsement; compatibility may be stated factually ("content derived from PF2e/SF2e
rules under the ORC License").

## Decision 3 — Source = ORC-derived, system-agnostic shipped seeds (Option B)

The owner wants **multiple optional trees usable by players in any world**, so the
content must not depend on which game system the world runs. That rules out the
runtime-bridge option and fixes the source:

| Option | What | Verdict |
|---|---|---|
| **B. Reship ORC-derived data (CHOSEN)** | Independently author each tree's *mechanics* into our own seed JSON with the ORC NOTICE; components reference our own shipped item uuids. | ✅ System-agnostic — works in a PF2e, SF2e, or any world. Requires the NOTICE + PI-exclusion pass. |
| A. Runtime read of an installed `pf2e`/`sf2e` *system* | Map that system's compendia at runtime. | ✗ A Foundry world runs **one** system, so each system's packs exist only in that system's world — can't offer *both* trees as options in one world. |
| C. Scrape Archives of Nethys (`2e.aonprd.com`, `2e.aonsrd.com`) | Bulk-pull AoN. | ✗ Rejected — AoN's *compilation/site* has its own terms; ORC licenses the rules text, not AoN's database. |
| D. Reship the `pf2e`/`sf2e` *system* compendia | Copy their packs. | ✗ Rejected — those packs ride a Foundry↔Paizo partnership + Community Use granted to *those* teams, and may include Reserved Material. |

So each tree is an **independently authored ORC-derived seed** we ship and seed via
the #36 pipeline — no system dependency, no scraping, no pack copying.

Sources for the landscape: official Foundry systems
https://foundryvtt.com/packages/pf2e , https://foundryvtt.com/packages/sf2e ;
SRDs https://2e.aonprd.com/ , https://2e.aonsrd.com/ (reference for transcription,
**not** a bulk-copy source).

## Decision 4 — Multiple optional trees behind a registry + per-tree toggle

```
   constants/settings:  EXAMPLE_TREES = [
     { id: "pf2e-smithing", file: "data/fabricate/pf2e-smithing.json", enabled: false },
     { id: "sf2e-tech",     file: "data/fabricate/sf2e-tech.json",     enabled: false },
   ]
   on ready (primary GM):  for each ENABLED tree -> seedSystem(file)   (idempotent, #36)
```

Each tree is its own Fabricate crafting system (its own id), seeded only when its
toggle is on (default **off**), kept clearly separate from a campaign's real
economy. Adding a tree later is just another seed file + registry entry. This is the
generalization of the single `keep-economy.json` seed already wired in
`FABRICATE.SEED_SYSTEMS`.

## Decision 5 — Seed shape (reuses the #36 Fabricate pipeline)

```
PF2e/SF2e item or material   ->  Fabricate Component
  (mechanics only)                { id, name(mechanical), sourceItemUuid: <our shipped uuid> }
crafting rule / formula      ->  Fabricate Recipe (simple mode, check optional)
                                  ingredientSets:[{ componentId, quantity }]
                                  resultGroups:  [{ componentId, quantity }]
component -> Keep resource   ->  component-map.js (componentId -> resourceKey)
```

Same builder/shape as the verified `keep-economy.json`. Because the seeds are
system-agnostic (our own uuids), the existing `readInventory` matcher and stockpile
projection work unchanged in any world.

## Decision 6 — Content delivery: shipped examples vs. import from owned content

**The question: how do later users get the *full* crafting tree?** We cannot
redistribute either system's full catalog — Reserved Material aside, the full set is
large, Product-Identity-laden, and (for paid content) not ours to give. So delivery
is **two-tier**, behind one pluggable importer:

```
        TreeSource (pluggable; one interface, several providers)
   ┌────────────────────────────────────────────────────────────────┐
   │ provenance        gets you …                 who is licensed     │
   ├────────────────────────────────────────────────────────────────┤
   │ shipped           small CURATED ORC          us (ORC + NOTICE)   │  ← now
   │                   example trees, direct                          │
   │ fabricate-library existing Fabricate          per upstream entry │  ← near-term
   │                   crafting systems (export)   license            │
   │ installed-system  the FULL tree from the      the USER (owns it) │  ← deferred
   │                   active pf2e/sf2e system                        │
   │ module / source-  the FULL/extra tree from a   the USER (owns it)│  ← deferred
   │ rule-package      purchased content module                       │
   │ user-export       a tree the user supplies     the USER          │  ← deferred
   └────────────────────────────────────────────────────────────────┘
```

- **Do we provide directly?** Yes — but only the **curated ORC example trees**
  (mechanics-only, with the NOTICE). That is the `shipped` provider, the scope of
  this change.
- **Do we import from their purchased content?** Yes — that is how a user gets the
  **full** tree, legally. The `installed-system` / `module` / `user-export`
  providers read content **the user already owns** (their installed game system, a
  purchased content module, or a file they supply), map it into Fabricate **locally
  on their machine**, and **never redistribute it**. We ship code, not their data.

**Provenance guard (load-bearing legal rule):** only `shipped` content may be
redistributed by us (it is our ORC-derived work + NOTICE). Every owned-content
provider is a *local transform* — its output is never re-exported, bundled, or
published by the module. This keeps the breadth path clean without us ever copying
Paizo's (or a third party's) catalog.

The interface is small (`{ id, provenance, isAvailable(), load() }` → a Fabricate
seed/system) so the `shipped` provider lands now and the import providers slot in
later without reworking the registry, toggles, or the seed pipeline.

**`fabricate-library` is the highest-leverage source.** Fabricate's own library of
crafting systems is *already* exported in Fabricate's envelope format, so our #36
`seedSystem` consumes it directly — the least-effort way to "build on existing
crafting trees." Its legal posture is **per the upstream entry's own license** (not
necessarily ORC): we honor whatever each library system is published under —
bundling it only if that license permits, otherwise treating it as user-fetched.
Practically near-term, after `shipped`.

## Decision 7 — Contribute back to the Fabricate library (two-way)

The relationship runs both directions: where we author or improve trees, we can
**contribute appropriate content back** to the Fabricate library/community so others
reuse it. The module already exports a system to Fabricate's envelope
(`exportSystem`, #36), so contribution is mostly a workflow + licensing discipline:

- **Only contribute content we have the right to share** — our own ORC-derived
  `shipped` trees (with the ORC NOTICE preserved in the export) and our own original
  work. **Never** contribute owned-content-provider output (`installed-system` /
  `module` / `user-export`) or Reserved Material — that isn't ours to redistribute.
- **Carry the license forward** — an exported ORC-derived tree must keep its ORC
  NOTICE so downstream Fabricate users inherit the attribution chain.
- **Respect Fabricate's contribution terms** — follow whatever the Fabricate
  library/repo requires for submissions.

This is a deferred workflow, but the `provenance` field makes it enforceable: the
contribution path accepts only `shipped`/original provenance.

## Risks

- **Trademark misuse** — branding with Paizo marks/logos. Mitigated by Decision 2/§
  trademark exclusion.
- **Reshipping Reserved Material by accident** (lore in descriptions, PI names, art).
  Mitigated by the PI-exclusion pass + the per-tree NOTICE.
- **PF2e OGL-vs-ORC mix** — accidentally sourcing pre-Remaster (OGL) PF2e content.
  Mitigated by sourcing the PF2e tree from Remaster (ORC) only.
- **Source-terms violation** — AoN scraping / copying system packs. Mitigated by
  rejecting Options C/D (Decision 3).
- **SF2e playtest vs final** — source the released SF2e ruleset, not the ORC playtest.

## Open questions

- **First tree scope** — start each tree narrow (a handful of materials + a few
  converter recipes) to validate the mapper and the NOTICE flow before breadth.
- **PI-name handling** — manual allow-list vs heuristic to keep Product-Identity
  names out of shipped seeds.
- **NOTICE surface** — file + per-tree description line; whether to add an about app.
- **Toggle home** — `FABRICATE.SEED_SYSTEMS`-style constant vs a user-facing setting
  per tree (likely a setting, since players choose).

## Coordinate with Fabricate

Fabricate owns the crafting *engine*; this change only *ships content* for it. Reuse
`fabricate-adapter.js` `seedSystem` and the component map; do not duplicate
Fabricate's recipe/check model. Keep each family's specifics inside its seed so the
Keep economy stays system-agnostic.

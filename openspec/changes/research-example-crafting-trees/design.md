# Design — Research Other Crafting Trees to Ship as Examples

## Context

The examples program (#38) ships PF2e + SF2e trees under ORC and defines a
provenance-tagged `TreeSource` (`shipped | fabricate-library | installed-system |
module | user-export`). This change researches *what else* we could offer, gated by
license. It reuses #38's model and the #36 Fabricate seed pipeline; it does not
author trees.

> **Disclaimer:** License findings below are engineering due-diligence as of
> 2026-06, **not legal advice.** Each must be confirmed before shipping; attribution
> strings/notices are mandatory where noted.

## Decision 1 — Evaluation criteria (license first)

Each candidate is scored on, in priority order:

1. **License reusability (tiered)** —
   - **First-class:** **CC-BY**, **ORC**, **MIT/permissive**, **public-domain**, or
     **our own original** work.
   - **Allowed but opt-in / lower-priority:** **OGL 1.0a / OGC** (see Decision 4).
   - **Rejected:** proprietary or Reserved-Material-only sources.
   In all cases, trademarks, lore, Product-Identity names, and art are excluded
   regardless of the mechanics' license.
2. **Source / provenance** — can we `ship` it (we redistribute, with required
   attribution), build on a `fabricate-library` entry, or only `import` from
   content the user owns?
3. **Breadth & fit** — does it have a real crafting/economy loop that maps to
   Fabricate components/recipes and the Keep stockpile?
4. **Effort** — transcription/mapping cost; PI-exclusion burden.

## Decision 2 — Seeded candidate catalog (to be completed by the research tasks)

| Candidate | License | Best source | Fit | Notes |
|---|---|---|---|---|
| **PF2e / SF2e** | ORC | shipped | high | Baseline — already #38. |
| **D&D 5e SRD 5.1 / 5.2.1** | **CC-BY-4.0** (also OGL 1.0a) | shipped | medium | Required attribution string (below); large item set; thin native crafting → pair with our converters. Data exists as structured CC-SRD repos. |
| **D&D 3.5 SRD / Pathfinder 1e** | **OGL 1.0a** (Open Game Content) | shipped | high | Rich item-creation/crafting (OGC); must carry OGL Section 15. Older license — confirm comfort with OGL vs CC/ORC. |
| **Fabricate library / community systems** | per-entry (MIT/CC/…) | fabricate-library | high | Already Fabricate-format → least effort; honor each entry's license; survey what exists. |
| **Original / public-domain trees** | none / ours | shipped | high | Generic smithing, alchemy, cooking, salvage, sci-fi tech — **zero license risk**, the safe default and a good no-dependency example. |
| **Other open SRDs (OSR/indie under CC/ORC/OGL)** | varies | shipped / library | varies | e.g. CC/ORC-licensed indie systems; evaluate case-by-case. |

**D&D 5.1 attribution (if shipped):** "This work includes material taken from the
System Reference Document 5.1 ('SRD 5.1') by Wizards of the Coast LLC … licensed
under the Creative Commons Attribution 4.0 International License" — plus note any
modifications. (Confirm exact current text + the 5.2.1 equivalent at ship time.)

## Decision 3 — Output: a ranked shortlist mapped to provenance

The research produces a shortlist, each pick carrying its `provenance` and license
posture, e.g. (illustrative, pre-research):

- **Original generic tree(s)** — `shipped`, no license risk → likely first/default.
- **Fabricate-library pick(s)** — `fabricate-library`, lowest effort.
- **5e CC tree** — `shipped`, with the CC-BY attribution.
- **OGL (3.5/PF1e) tree** — `shipped`, with OGL §15 — pending OGL-comfort decision.

Shortlisted picks become implementation items under #38 (its `TreeSource` +
registry), not here.

## Decision 4 — Accept both CC-BY and OGL, each behind its own per-tree notice

**Resolved:** we take **both** license families, kept isolated per tree, each
carrying its own required notice — but they are **not** treated equally.

- **First-class (lead with these):** CC-BY (5e SRD), ORC (PF2e/SF2e), permissive, and
  original/public-domain. Modern, simple notices, irrevocable (CC) / purpose-built
  (ORC), and **contributable** upstream.
- **OGL 1.0a — allowed but opt-in and clearly labeled.** Include an OGL tree (e.g.
  3.5/PF1e) only when its crafting depth earns its cost. Its costs, accepted
  knowingly:
  - **Section 15 chain** must be reproduced and kept accurate (fragile, growing).
  - **Not contributable** as CC/ORC (OGC can't be relicensed) — a dead-end for the
    contribute-back path (#38 Decision 7).
  - **Reputation/uncertainty** — OGL 1.0a carries the 2023-controversy cloud.

**Isolation rule (load-bearing):** one tree = one license = one notice; never
commingle content across regimes. The OGL tree sits behind **its own toggle** so the
rest of the module never inherits OGL obligations. This is enforceable via the
per-tree `provenance` + license metadata from #38.

| | CC-BY (5e) | ORC (PF2e/SF2e) | OGL 1.0a (3.5/PF1e) |
|---|---|---|---|
| Notice | one attribution string | ORC NOTICE block | OGL text + Section 15 chain |
| Irrevocable | yes | n/a (purpose-built) | disputed (deauth attempt) |
| Contributable upstream | yes | yes | **no** |
| Maintenance | low | low | **higher** |
| Priority | first-class | first-class | opt-in / lower |

## Decision 5 — Keep the catalog current

Licenses and sources shift (e.g. the 2023 OGL/CC events, ORC adoption, new SRD
versions like 5.2.1). The catalog is a **living artifact** re-checked when a
candidate is picked up or when a known license/source changes.

## Risks

- **License drift / misread** — mitigated by license-first criteria + a confirm-at-ship
  step and counsel review (per #38).
- **OGL posture** — resolved (Decision 4): OGL is allowed but opt-in/labeled, kept
  isolated per tree so its obligations never spread to the rest of the module.
- **Reserved Material leakage** (lore/PI names/art) — excluded by criterion 1
  regardless of the mechanics license.

## Open questions

- How many example trees is "enough" before breadth becomes noise?
- Which to pursue first — the zero-risk **original** tree, or a **fabricate-library**
  pick (lowest effort)?

## Sources
- D&D SRD 5.1/5.2.1 (CC-BY-4.0): https://www.dndbeyond.com/srd ,
  https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf
- "What 5e in the CC means" (SlyFlourish): https://slyflourish.com/what_5e_in_cc_means_to_you.html
- Structured CC-SRD data (example): https://github.com/Tabyltop/CC-SRD
- OGL/ORC context (Paizo): https://paizo.com/licenses

# Design — Crafting Tutorial & Example-Module Boilerplate

## Context

The engine works (seed pipeline, flag-backed Keeps, tick/rules, KeepApp, benefits),
and `MODULE-PLAYBOOK.md` / `STARTER-MODULES.md` describe the ecosystem. The missing
links are *learning* (for players/GMs) and a *starting scaffold* (for authors). This
change adds both, reusing existing machinery and the licensing discipline (#38/#40).

## Decision 1 — Tutorial is opt-in, self-contained, original, and removable

- **Opt-in & non-destructive:** launched by a macro/setting; it creates its own
  sample Keep + tutorial tree and never touches a campaign's real data.
- **Original content only:** the tutorial tree is generic/original (e.g. "scrap →
  ingot → tool") so it carries **zero licensing risk** and ships freely.
- **Teaches the real loop:** journal/scene steps walk gather → craft → stockpile →
  advance time → see results, using the actual `api.*` surfaces (so what they learn
  transfers).
- **Removable:** a teardown removes the sample Keep/tree, leaving the world clean.
- **Help in context:** a "How crafting works" entry point from the Keep panel and a
  link to docs.

```
   Tutorial flow (illustrative)
   1. Open the sample Keep panel        -> see an empty stockpile
   2. Harvest (or grant) raw "scrap"    -> stockpile shows scrap
   3. Run the convert recipe            -> scrap -> ingot
   4. Advance a day (Time Controls)     -> a tick-bound rule auto-crafts
   5. Read the run history / stockpile   -> understand projection
   6. Teardown                           -> world restored
```

**Tutorial medium — resolved (researched against Foundry norms): compose native
mechanisms, don't build a bespoke app.**

- **Foundry Tours** (`game.tours` / `Tour`) drive the interactive walkthrough — the
  built-in framework that highlights UI/canvas/journal elements step by step, tracks
  progress, and is re-runnable from the Tours Management Panel. Purpose-built for
  "teach a module's mechanics," so a custom guided ApplicationV2 is **rejected** (it
  would rebuild Tours).
- **A setup/teardown macro** creates and removes the sample Keep + tutorial tree —
  this is what makes the tutorial **opt-in and removable**.
- **Journal pages** (in a compendium) are the static reference, linked from the Tour
  and the Keep-panel help entry.
- **Adventure import is NOT used for the tutorial** — it imports permanently with no
  clean teardown, conflicting with removability; reserve it for the *starter world*
  content, not this removable tutorial.

Staged: **v1** = journal pages + setup/teardown macro (lowest effort, runs before any
content packaging); **v2** = add the Tour for the guided UI walkthrough.

## Decision 2 — Boilerplate is a copyable, license-clean skeleton (not a generator)

Ship a real example module under `examples/<boilerplate>/` that an author copies and
renames. It encodes the playbook as working files, not prose:

- `module.json` — required `relationships` (automate-fvtt + fabricate; soft calendar),
  `compatibility`, `manifest`/`download` placeholders, `esmodules`.
- Entry script — `automate-fvtt.ready` hook, primary-GM-guarded, using **only**
  `game.modules.get("automate-fvtt").api` (detect-active, graceful absence).
- Sample content — a tiny crafting-tree seed JSON, a `setComponentMap` call, an
  example economy rule, a Keep creation, an example benefit; a scene/node + gathering
  link stub.
- Onboarding — a minimal splash/importer skeleton (the bandits pattern).
- Tests — a `node --test` unit stub + a Playwright surface/smoke stub that skips
  cleanly without a licensed Foundry.
- **Licensing** — `NOTICE` templates for CC-BY, ORC, and OGL (Section 15 stub) and a
  short licensing-checklist file; one license per shipped tree.

A code generator/CLI is explicitly deferred — a copyable skeleton delivers most of
the value now.

**Boilerplate home — staged (resolved).** Two distinct artifacts were conflated:
a *demonstration* (read-as-reference, proves the API, stays in lockstep) vs. a
*starter authors clone* (one-click new project). The Foundry norm for the latter is
a **GitHub template repository** ("Use this template" — e.g. the League of Foundry
Developers template; asacolips' boilerplate paired with a wiki tutorial mirrors our
boilerplate+playbook pairing). Decision:

- **Now:** ship the boilerplate **in-repo under `examples/`** as the reference the
  playbook points at — tightest lockstep with the engine + smoke test, one repo.
- **Later (deferred):** **graduate it to a separate GitHub template repository**,
  **generated from the in-repo `examples/` copy** (a CI publish step) so there is a
  single source of truth and no drift.
- **Not now:** a create-CLI/scaffolder — most effort, premature.

## Decision 3 — Keep both in lockstep with the playbook

The boilerplate is the **executable form of `MODULE-PLAYBOOK.md`**; they must agree.
Cross-link both directions, and treat a playbook change as a prompt to update the
skeleton (and vice-versa). The tutorial's "what you learn" mirrors the same `api.*`
surfaces the boilerplate uses.

## Risks

- **Drift** between playbook, boilerplate, and the live API — mitigated by the
  lockstep rule (Decision 3) and the boilerplate's smoke test.
- **Tutorial mutating real data** — mitigated by self-contained sample Keep + teardown.
- **Boilerplate shipping as a real module by accident** — keep it under `examples/`,
  not packaged/released; document "copy, don't depend."

## Open questions

- Tutorial medium — **resolved** (Decision 1): Foundry **Tours** (interactive driver)
  + setup/teardown **macro** (removable sample data) + **journal** reference; no
  bespoke app; Adventure import reserved for the starter world. v1 journal+macro,
  v2 adds the Tour.
- Boilerplate home — **resolved** (Decision 2): in-repo `examples/` now → graduate to
  a generated GitHub template repo later. Open sub-question: the CI step that
  generates/publishes the template repo from `examples/`.
- How much of the tutorial can be reused as the MVS starter's onboarding?

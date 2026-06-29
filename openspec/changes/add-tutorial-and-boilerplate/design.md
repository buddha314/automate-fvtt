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

- Tutorial medium: journal pages vs. a dedicated guided ApplicationV2 vs. an
  Adventure import — start with journal + macro for lowest effort?
- Does the boilerplate live in this repo (`examples/`) or a separate template repo
  (GitHub "template repository")? In-repo first; extract later if it grows.
- How much of the tutorial can be reused as the MVS starter's onboarding?

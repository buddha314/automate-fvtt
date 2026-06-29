# Add Crafting Tutorial Content & Example-Module Boilerplate

## Why

Two onboarding gaps sit between the engine and a thriving ecosystem:

1. **Players/GMs need to learn the crafting loop.** The mechanism (gather → craft →
   stockpile → time-advance) is unfamiliar; a new GM dropped into a Keep world won't
   know what to do. We need **in-world tutorial content** that teaches it hands-on.
2. **Authors need a running starting point.** `MODULE-PLAYBOOK.md` documents *how* to
   build a content module, but prose isn't a project skeleton. We need **boilerplate**
   — a copyable example module that encodes the playbook so authors start from a
   working, license-clean scaffold instead of a blank page.

Both lower the cliff on the playtest ladder (epic #41): the tutorial makes a playtest
legible to testers; the boilerplate makes the starter/content modules faster to build.

## What Changes

- **A crafting tutorial** (`crafting-tutorial`): an opt-in, self-contained, removable
  guided walkthrough — journal/scene-based — that runs the full loop on a sample Keep
  with a minimal **original** tutorial tree (no licensing risk), with help surfaced
  from the Keep panel/docs.
- **Example-module boilerplate** (`example-module-boilerplate`): a copyable skeleton
  module that encodes the playbook — `module.json` template (required relationships),
  ready-hook wiring via the **public API only**, sample crafting-tree seed, sample
  scene/node + gathering link, sample Keep + economy + benefit setup, splash/importer
  skeleton, a tests skeleton, and **per-license NOTICE templates** (CC-BY / ORC / OGL)
  + a licensing-checklist stub.

## Impact

- **Specs:** new `crafting-tutorial` and `example-module-boilerplate` capabilities.
- **Code/content:** a tutorial pack (journal/scene/tree/Keep + setup + teardown
  macro); a `examples/<boilerplate>/` skeleton + NOTICE templates; doc cross-links
  from `MODULE-PLAYBOOK.md` / `STARTER-MODULES.md`.
- **Depends on:** the seed pipeline (#36), the `TreeSource`/provenance + licensing
  model (#38, #40), the playbook (#42). Supports onboarding rungs of epic #41.

## Non-goals

- The full **starter content module** / MVS world (tracked separately under
  STARTER-MODULES / epic #41) — this provides the *teaching* content and the
  *author scaffold*, not a shipped adventure.
- Authoring the real PF2e/SF2e/5e example trees (#38) — the tutorial uses an original
  minimal tree.
- The crafting engine itself (Fabricate).
- A code generator/CLI for the boilerplate (possible later; out of scope here).

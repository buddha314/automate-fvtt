# Tasks — Crafting Tutorial & Example-Module Boilerplate

## 1. Crafting tutorial
- [ ] 1.1 Author an **original** minimal tutorial tree (e.g. scrap → ingot → tool); zero license risk.
- [ ] 1.2 Tutorial walkthrough content (journal pages and/or a guided app) covering
  gather → craft → stockpile → advance-time → read results, using the real `api.*`.
- [ ] 1.3 Launch macro/setting that creates a sample Keep + seeds the tutorial tree
  (opt-in, non-destructive).
- [ ] 1.4 Teardown that removes the sample Keep + tutorial tree.
- [ ] 1.5 Help entry point from the Keep panel + docs link.
- [ ] 1.6 Live test: launch → complete a craft → projection visible → teardown clean.

## 2. Example-module boilerplate
- [ ] 2.1 `examples/<boilerplate>/module.json` — relationships (automate-fvtt + fabricate;
  soft calendar), compatibility, manifest/download placeholders, esmodules.
- [ ] 2.2 Entry script — `automate-fvtt.ready`, primary-GM guard, public-API-only,
  graceful absence of soft deps.
- [ ] 2.3 Sample crafting-tree seed JSON + `setComponentMap` + an economy rule.
- [ ] 2.4 Sample Keep creation + an example benefit.
- [ ] 2.5 Scene / resource-node + gathering-link stub.
- [ ] 2.6 Onboarding splash/importer skeleton (bandits pattern).
- [ ] 2.7 Tests skeleton — `node --test` unit stub + Playwright surface/smoke stub
  that skips without a licensed Foundry.
- [ ] 2.8 NOTICE templates (CC-BY / ORC / OGL Section 15 stub) + licensing checklist.

## 3. Docs & lockstep
- [ ] 3.1 Cross-link `MODULE-PLAYBOOK.md` ⇄ the boilerplate and `STARTER-MODULES.md`.
- [ ] 3.2 Note the lockstep rule (playbook change ⇒ boilerplate update) in both.

## 4. Decisions to confirm
- [ ] 4.1 Tutorial medium — journal+macro (proposed) vs. guided app vs. Adventure import.
- [ ] 4.2 Boilerplate home — in-repo `examples/` (proposed) vs. a separate GitHub template repo.

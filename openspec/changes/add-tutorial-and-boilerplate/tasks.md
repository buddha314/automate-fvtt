# Tasks — Crafting Tutorial & Example-Module Boilerplate

## 1. Crafting tutorial
- [ ] 1.1 Author an **original** minimal tutorial tree (e.g. scrap → ingot → tool); zero license risk.
- [ ] 1.2 v1 walkthrough as **journal pages** covering gather → craft → stockpile →
  advance-time → read results, using the real `api.*`.
- [ ] 1.2b v2: a **Foundry Tour** (`game.tours`) that highlights the Keep panel →
  harvest/craft → Time Controls → stockpile; re-runnable from the Tours panel.
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

## 4. Decisions
- [x] 4.1 Tutorial medium — **resolved (2026-06-29):** Foundry **Tours** (interactive
  driver) + setup/teardown **macro** (removable sample data) + **journal** reference;
  no bespoke app; Adventure import reserved for the starter world. v1 journal+macro,
  v2 adds the Tour. See design Decision 1.
- [x] 4.2 Boilerplate home — **resolved (2026-06-29):** in-repo `examples/` now →
  graduate to a **generated** GitHub template repo later (single source of truth);
  no create-CLI for now. Foundry norm is template repos (League template,
  asacolips boilerplate+wiki). See design Decision 2.

## 5. Graduate to a template repo (deferred)
- [ ] 5.1 CI step that generates/publishes a standalone GitHub template repository
  from the in-repo `examples/` boilerplate (kept drift-free).

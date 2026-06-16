# Add Keep Membership & Benefits

## Why

Issue [#25](https://github.com/buddha314/automate-fvtt/issues/25) asks Keeps to do
more than hold a stockpile: **members** (PC or NPC) should derive **benefits** from
membership, and those benefits must work across many game systems without the
engine hard-coding any one system's rules (a "long rest" means nothing to the
engine). Today `KeepModel` is purely economic — `stockpile` / `counts` / `buffers`
— with no concept of members or benefits.

The issue's own benefit examples (reduced rest time, cheaper merchants, summon the
guard, advantage while in the Keep, access to gathered resources, storage/voting)
do **not** share one mechanism — they split four ways. That polymorphism, plus the
"there is always a human GM" constraint, is the heart of this change.

## What Changes

- Add **membership** to Keeps: a roster of references to Foundry Actors, each with
  a role. Members are existing PC/NPC actors, not new documents.
- Add a **benefit** abstraction with four expression primitives —
  **Effect · Modifier · Capability · Action** — that *content* registers via the
  API. The engine provides the mechanism; it never knows what a long rest is.
- Add a **benefit resolver**: an event-driven sibling to the tick rules engine
  that decides which benefits are live per member (role / tier / condition gating)
  and applies or revokes each benefit's expression.
- Add per-benefit **resolution modes** (`interactive` is the default, opt into
  `auto`), reusing the rules-engine mode axis. Interactive benefits surface a GM
  prompt and **never block a clock fast-forward** (only interactive *tick rules*
  do).
- Ship a small **generic cookbook** of system-agnostic example benefits, plus
  **importer seams** to auto-port benefits from license-permissive content (OGL
  PF2e Kingmaker structures, etc.) — the same ingestion seam as issue #20.
- Extend the public API: `api.keeps.members.*` and `api.benefits.*`.

## Impact

- **Specs:** new `keep-benefits` capability.
- **Code:** `scripts/data/keep-model.js` (members, benefit bindings), new
  `scripts/benefits/*` (registry + resolver + primitives), `scripts/keep-api.js`,
  `scripts/constants.js` (new hooks), `scripts/apps/keep-sheet.js`.
- **Depends on (reads, does not build):** tier computation (`keep.tier`) and Time
  Controls fast-forward. Change **B** (`add-scheduled-events-calendar`) builds on
  these benefit primitives (timed grant/revoke), so do A first.

## Non-goals

- Tier / metrics computation (size, land area, lawfulness → tier) — separate change.
- GM clock controls (start/stop/fast-forward) and the scheduled-events calendar —
  Change B.
- System-specific benefit content beyond the generic starter set and reference
  importers (that lives in content modules per `engine-vs-content-split`).

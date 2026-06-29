# Starter Modules — what a GM installs to start a game

Outline of the module/content set a new GM needs to go from "nothing installed" to
"a playable Keep-economy game," organized in layers. The engine (this module) is
useless to players without a content layer on top; this is the bundle that makes it
real. Tracked against the playtest ladder (epic #41).

## Layer 1 — Engine (required)

The mechanism itself. A starter game cannot run without these.

| Module | Role | Dep type |
|---|---|---|
| **automate-fvtt** (this) | Keep economy: keeps, tick/rules engine, stockpile, membership/benefits, the Fabricate seam | — |
| **fabricate** | Crafting + gathering engine our economy is backed by | **required** (module.json) |
| **a calendar module** | World-time UI + scheduled events (Calendaria preferred; Seasons & Stars fallback) | recommended (soft) |

These are wired already; the gap is everything below.

## Layer 2 — Content (what makes it a game)

A GM should not have to hand-build a crafting system, place nodes, and configure a
Keep. A **starter content module** ships that, importable in one click — the
`bandits-on-the-river` pattern (welcome splash → native Adventure importer).

A complete starter content module provides:

- **A world/adventure pack** — scenes, NPCs/merchants, journals, a starting party
  context (the `Adventure` document + importer).
- **A pre-built Keep** — a flag-backed Keep actor with a starting stockpile,
  membership, and a component map already configured.
- **At least one crafting tree** — an enabled example tree (#38) so there's
  something to craft (ORC/CC-BY/original; with its NOTICE).
- **Gathering content** — a Fabricate gathering environment + task tied to a scene,
  with **resource nodes placed on the map** (scene compendium pack), so the harvest
  loop runs on time advance.
- **A merchant** — a stocked/​restocking merchant (see `MERCHANT.md`) for the
  buy/sell side of the economy.
- **Economy rules** — registered harvest/craft/upkeep rules bound to the Keep.
- **Onboarding** — a welcome splash that checks deps (pf2e/system, automate-fvtt,
  fabricate, calendar) and drives the one-click import.

## Layer 3 — Onboarding & docs (lowers the cliff)

- A **quickstart** (install → import → advance a day → see resources move).
- The **Keep panel** (`api.keeps.open`) and **Time Controls** surfaced for the GM.
- Troubleshooting (missing dep, Fabricate build stale, etc.).

## The Minimum Viable Starter (MVS)

The smallest thing that is actually playable end-to-end:

1. Engine deps (Layer 1).
2. **One** content module that imports: 1 scene + 1 Keep + 1 crafting tree (1–2
   recipes) + 1 gathering node + 1 merchant + the bound economy rules.
3. A splash/quickstart for onboarding.

Everything past the MVS (more trees, more scenes, disruptions/scheduled events,
multiple systems) is incremental content.

## What exists vs. what's needed

| Piece | Status |
|---|---|
| Engine layer | ✅ built |
| Seed pipeline + stockpile projection | ✅ built |
| Example crafting trees | ⛔ #38 (planned) |
| Gathering env/task + placed nodes | ⛔ not built (Rung 2, epic #41) |
| Starter content module (world + Keep + merchant + rules) | ⛔ not built |
| Onboarding splash/importer | ◑ pattern exists (bandits-on-the-river) |
| Install-from-manifest for testers | ◑ works; hardening in #39 |

## Build order (maps to epic #41)

1. **MVS content module** once Rung 1–2 (real-item craft + gathering) land.
2. First **example tree** (#38) enabled in the starter.
3. **Merchant** stocking/restocking.
4. **Disruption** scenario (scheduled events) for narrative depth.
5. **Distribution** (#39) so playtesters can install the bundle.

> Authors building these modules follow [MODULE-PLAYBOOK.md](MODULE-PLAYBOOK.md).

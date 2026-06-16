# Design — Scheduled Events / GM Calendar

## Context

`automate-fvtt` builds on core `game.time` + `updateWorldTime` (Phase 2), with a
GM-elected `advance()` driver and a planned `running | paused | fast-forward` clock
(`rule-resolution-modes`, `dependency-strategy`). The tick rules engine already does
**idempotent span integration** — applying one delta across a jumped time span
rather than looping per step. Scheduled events ride the same machinery for discrete
dated occurrences. Change A (`add-keep-membership-benefits`) supplies the benefit
primitives that `grantBenefit`/`revokeBenefit` events reuse.

**Guiding ethos: work ourselves out of a job.** Build only the differentiated core
(the event queue + replay correctness); skin an existing calendar module for UI,
storage, and visibility rather than building a calendar ourselves.

## Goals

- A single GM-facing timeline for discrete Keep events (deliveries, disruptions,
  festivals, recruiting), with GM-only foreshadowing.
- Correct behavior under manual fast-forward — the engine, not a plugin, owns
  replay correctness.
- Reuse existing axes (auto/interactive resolution) and existing subsystems
  (benefits, tick rules, stockpile) rather than inventing parallel ones.

## Non-goals

- Benefit primitives (Change A), tier math, continuous per-tick production.

## Decision 1 — Engine-owned event queue with replay-on-jump

```
        GM CALENDAR  (one timeline of discrete events)
   ════════════════════════════════════════════════════════════
   Mon        Tue        Wed         Thu         Fri        Sat
    │          │      ✦ shipment      │      ⚠ bandits     │  🎪 festival
    │          │        arrives       │       raid road    │  +1 morale (window)
    │          │     depositResources │      toggleRule    │  grant/revoke benefit
   ────────────────────────────────────────────────────────────
              auto ▲                  interactive ▲          auto ▲
```

On `advance(T0 → T1)` the engine processes every event occurrence with
`fireAt ∈ (T0, T1]` **in chronological order**:

```
sort due occurrences by fireAt
for each occurrence O:
   if O.mode == interactive:
        HALT the jump at O.fireAt, surface GM prompt   ← like an interactive tick rule
        (resume continues from O.fireAt after GM resolves)
   else:
        apply O.payload, mark O applied, advance watermark to O.fireAt
```

This mirrors `rule-resolution-modes`: a fast-forward only flows freely across an
`auto`-only span; the first `interactive` occurrence caps the jump at its boundary.
Deterministic events (`depositResources`, `toggleRule`, auto `grant/revoke`) apply
silently; `promptGM` (and any interactive event) halts.

## Decision 2 — Idempotent processing via a watermark + applied flags

Each queue carries a `lastProcessedTime` watermark; each occurrence records an
`applied` state. Re-running the same span (or a partially-overlapping one) never
double-applies — the same property the tick engine relies on. This is what makes
"advance a week" safe to repeat, undo, or resume after an interactive halt.

## Decision 3 — Four event kinds, reusing existing subsystems

| Kind                | Payload                       | Default mode | Reuses |
|---------------------|-------------------------------|--------------|--------|
| `depositResources`  | `{ resource: delta, … }`      | auto         | stockpile API |
| `grantBenefit`      | `{ benefitId, window? }`      | auto/interactive | Change A |
| `revokeBenefit`     | `{ benefitId }`               | auto         | Change A |
| `promptGM`          | `{ message }`                 | interactive  | GM prompt seam |
| `toggleRule`        | `{ ruleId, enabled }`         | auto         | rules engine |

A `grantBenefit` with a `window` auto-schedules its paired `revokeBenefit` at the
window end (the festival's "+1 morale this weekend"). No fifth kind needed — these
delegate into subsystems that already exist (Change A benefits, the rule engine,
the stockpile).

## Decision 4 — One-time and simple recurring occurrences

Events are one-time or **simple recurring** (fixed interval). Recurrence expands
into occurrences the queue processes individually; each occurrence is idempotent.
**Continuous per-tick production stays in the rules engine** — scheduled events are
for *discrete dated* occurrences (even if they recur, like "every full moon"),
never a replacement for producer/upkeep flow.

## Decision 5 — Calendar module is an optional UI skin; engine owns correctness

```
   ENGINE        owns the queue + replay + idempotency. Source of truth.
   CALENDAR      optional skin: render occurrences on a real calendar, GM
   MODULE        places/edits/toggles visibility, drives /advance.
   FALLBACK      a minimal built-in event list when no module is present.
```

**Chosen skin: Calendaria** (https://foundryvtt.com/packages/calendaria;
source https://github.com/Sayshal/Calendaria) — **free and MIT-licensed**
(verified 2026-06-15 via its `LICENSE` file and `module.json` `license` field;
compatible with our MIT module). Why it fits:

- **Free**; Foundry **v13.351 → v14.364** (matches our v13 target).
- **`CALENDARIA.api`** for module integration + `/advance` and cinematic time-skip.
- **Note scheduling with conditions** and **three visibility levels
  Visible / Hidden / Secret + Fog of War** ("players only see dates the GM has
  revealed") — this *is* Decision 6's GM-only foreshadowing, off the shelf.
- Imports calendars from Simple Calendar / Fantasy-Calendar, easing GM onboarding.

**Alternative:** Seasons & Stars (already a soft dep in `dependency-strategy`).
About Time Next optional as a convenience scheduler — **never the source of truth.**
**Avoid Simple Calendar** (v12-only).

Whichever module we skin, integration follows **Fabricate's integration contract**
(`dependency-strategy`): feature toggle, detect-installed-and-active, exchange via
public API only, graceful absence (no errors when absent), documented version
range, tests that mock the module API. The calendar-adapter seam keeps the choice
swappable so the engine never hard-codes one module.

## Decision 6 — Visibility is GM-only foreshadowing

Each event has `visibility: gm | players`. GM-only events are hidden from players
until the GM reveals them; players still experience the *effect* when it fires (the
wheat stops) without seeing the *cause* (the raid). Calendaria's
Visible/Hidden/Secret + Fog of War maps onto this directly; if we skin a module
without native hidden notes, we track visibility ourselves and filter the rendered
view.

## Coordinate with Fabricate (watch)

Fabricate's specs (`../fabricate/openspec/specs`) list a planned **Simple Calendar
"time-gate progression"** integration and ship **gathering/harvesting time-gating**;
both ride core world-time. Risk of duplicated calendar/time-gating effort — read
and coordinate via the public API behind `fabricate-adapter.js` rather than
rebuilding. Terminology: Fabricate "resolution modes" (`simple/routed/progressive/
alchemy`) ≠ our `auto/interactive`.

## Open questions

- **Event store location** — world setting vs per-Keep actor flag vs Journal-backed
  vs the calendar module's own note store. Fabricate uses world settings +
  `flags.fabricate.*` actor flags; aligning may ease a future shared integration.
- **Scheduler backend** — how much to lean on the calendar module's own
  scheduling/advance vs our engine driver, given the engine must own fast-forward
  correctness regardless.
- **Recurrence model** — simple fixed interval (proposed) vs richer RRULE-style.
- **Event scope** — keep-scoped only, or also world-scoped events?

## Risks

- A calendar module that schedules against flowing time may mis-fire on manual
  jumps — mitigated by engine-owned replay (Decision 1), module as skin only.
- Calendaria becomes unmaintained or changes license — mitigated by the swappable
  calendar-adapter seam (fall back to Seasons & Stars).
- Overlap with Fabricate's calendar/time-gating plans — mitigated by the watch note
  and reading via the adapter.

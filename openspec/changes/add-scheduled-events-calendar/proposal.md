# Add Scheduled Events / GM Calendar

## Why

GMs need to schedule timeline events for a Keep — a shipment arriving next week, a
bandit raid that disrupts the wheat supply, a festival, a recruiting cadence — and
some of these should be **hidden from players** (foreshadowing). This generalizes
the one-off "scheduled delivery" idea into a single GM-facing timeline, and makes
the `KEEP.md` river-wheat disruption story directly expressible: players feel the
wheat stop without seeing the bandit raid the GM placed three days out.

The hard part is not storing events — it is that the Keep's killer feature is the
**manual fast-forward** ("advance a week"). Events must fire (or integrate)
correctly when the GM yanks the clock forward in one click. That replay logic must
be engine-owned, not delegated to a calendar plugin that schedules against flowing
time.

## What Changes

- An engine-owned **event queue on world-time** with **replay-on-jump**: when the
  clock advances/fast-forwards, every event whose fire time falls in the jumped
  span is processed in chronological order — the same idempotent span integration
  the tick engine already does.
- **Four event kinds**, resolving by mode (`auto | interactive`, the same axis as
  benefits and tick rules):
  - `depositResources` — adjust the stockpile (positive or negative). `auto`.
  - `grantBenefit` / `revokeBenefit` (optionally on a **window**) — reuses Change A
    primitives. `auto` or `interactive`.
  - `promptGM` — surface a narrative prompt; **halts a fast-forward** at its fire
    time. `interactive`.
  - `toggleRule` — enable/disable a tick rule (the wheat-supply disruption). `auto`.
- Per-event **visibility** flag (`gm | players`); GM-only events are hidden from
  players in the calendar UI until/unless the GM reveals them.
- **One-time and simple recurring** events; each occurrence is processed exactly
  once (idempotent).
- **Soft-depend on a calendar module** purely as a UI skin to place/view/toggle
  events, mirroring Fabricate's integration contract (toggle, detect-active,
  public-API-only, graceful absence, version range, mocked-API tests). Fall back to
  a minimal built-in list. **Never required for correctness.** Chosen skin
  **Calendaria** (free, **MIT**, `CALENDARIA.api`, native Visible/Hidden/Secret +
  Fog-of-War visibility, v13–14); fallback Seasons & Stars; About Time Next
  optional. Avoid Simple Calendar (v12-only).

## Impact

- **Specs:** new `scheduled-events` capability.
- **Code:** new `scripts/time/event-queue.js` (queue + replay), event-kind
  handlers, `scripts/constants.js` (hooks), a calendar-adapter seam, sheet/UI.
  Hooks into the Time Controls `advance()` path (core `game.time` +
  `updateWorldTime`, Phase 2).
- **Depends on:** Change **A** (`add-keep-membership-benefits`) for
  grant/revoke-benefit events; the Time Controls advance/fast-forward path; the
  rules engine's rule enable/disable for `toggleRule`.
- **Watch Fabricate:** its specs list a planned Simple Calendar "time-gate
  progression" integration and ship gathering/harvesting time-gating. Both ride
  core world-time — coordinate so we read/consume rather than duplicate. See
  `dependency-strategy`.

## Non-goals

- The benefit primitives themselves (Change A).
- Tier / metrics computation.
- Continuous per-tick production (stays in the rules engine; scheduled events are
  for **discrete dated occurrences**, even if recurring).
- A full calendar/clock UI of our own — we skin an existing plugin or fall back to
  a minimal list.

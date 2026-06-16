# Tasks — Scheduled Events / GM Calendar

## 1. Event queue core
- [ ] 1.1 Define the event model (id, scope/keepId, fireAt, recurrence?, kind, payload, mode, visibility).
- [ ] 1.2 Implement the queue store (location TBD — see design open Q) and ordered-by-fireAt retrieval.
- [ ] 1.3 Implement `lastProcessedTime` watermark + per-occurrence `applied` state.

## 2. Replay-on-jump
- [ ] 2.1 Hook the Time Controls `advance()` / `updateWorldTime` path.
- [ ] 2.2 Process due occurrences in chronological order across a jumped span.
- [ ] 2.3 Auto occurrences apply silently; interactive occurrences HALT the jump at fireAt and resume after GM resolution.
- [ ] 2.4 Guarantee idempotency — re-running/overlapping a span never double-applies.

## 3. Event kinds
- [ ] 3.1 `depositResources` → stockpile adjust (auto).
- [ ] 3.2 `grantBenefit` / `revokeBenefit` (reuse Change A); a `window` auto-schedules the paired revoke.
- [ ] 3.3 `promptGM` → GM prompt (interactive).
- [ ] 3.4 `toggleRule` → enable/disable a tick rule (auto).

## 4. Recurrence
- [ ] 4.1 One-time + simple fixed-interval recurrence, expanded into idempotent occurrences.
- [ ] 4.2 Keep discrete dated events distinct from continuous per-tick production (rules engine).

## 5. Calendar module integration (skin)
- [x] 5.1 Verify Calendaria's license — **MIT, compatible** (verified 2026-06-15). Chosen as the skin; Seasons & Stars remains the fallback.
- [ ] 5.2 Build a swappable calendar-adapter seam (no hard-coded module).
- [ ] 5.3 Render occurrences via the module API; let the GM place/edit/toggle visibility.
- [ ] 5.4 Map visibility (gm/players) onto the module's native levels (Calendaria Visible/Hidden/Secret + Fog of War) or filter ourselves.
- [ ] 5.5 Follow Fabricate's integration contract: toggle, detect-active, public-API-only, graceful absence, version range.
- [ ] 5.6 Minimal built-in event-list fallback when no calendar module is present.

## 6. Tests & docs
- [ ] 6.1 Replay tests: chronological order, interactive halt/resume, idempotency across overlapping spans.
- [ ] 6.2 Event-kind tests (deposit, grant/revoke window, promptGM, toggleRule).
- [ ] 6.3 Calendar-adapter tests mocking the module API (absent / present-toggle-off / present-on).
- [ ] 6.4 Update `docs/KEEP.md` and JSDoc for the scheduled-events API surface.

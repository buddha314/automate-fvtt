# Tasks — Keep Evolution

## 1. Tier model & metrics
- [x] 1.1 Ground in `KEEP.md` (hamlet→city tiers; metrics: membership, area, order) +
  PF2e Kingmaker size/level prior art + the output/merchant tier stubs.
- [x] 1.2 Pure `computeTier(metrics, table)` — highest tier whose minimums are all met
  (`evolution/evolution.js`, unit-tested).
- [x] 1.3 Metric map on the Keep (`metrics` flag) + derived membership (`metricsOf`);
  `setMetric` API. Treasury/structures-as-metric is the open growth-driver question.
- [x] 1.4 Default `DEFAULT_TIER_TABLE` (`KEEP.md` brackets), overridable via
  `configureEvolution({ tierTable })`.

## 2. Recompute engine  ✅ BUILT
- [x] 2.1 Recompute on metric/membership change, authoritative GM, write the `tier`
  flag (`recomputeTier`, `registerEvolutionEngine`).
- [x] 2.2 Emit `HOOKS.TIER_CHANGED` when the tier moves; event-driven, off the tick.
- [ ] 2.3 Optional cheap tick backstop re-check (deferred).

## 3. Tier → economy outputs
- [x] 3.1 Per-tier **storage capacities** (`capacitiesForTier`) written to the Keep
  `capacities` flag on tier change; `applyOutputPipeline` reads per-keep caps (merged
  over the global). Lights the output-pipeline cap stub end-to-end.
- [ ] 3.2 Per-tier **consumption** scaling → upkeep rules. **Choke: model undecided (4.3).**
- [ ] 3.3 Per-tier **merchant attraction** auto-applied to merchants. **Choke: how
  aggressively to mutate existing merchants (4.x).**
- [ ] 3.4 **Benefit tier-gate** — a benefit def may require a minimum tier (follow-on).

## 4. Decisions
- [x] 4.1 Tier-from-metrics rule — **minimum-across-brackets** (built: highest bracket
  whose every minimum is met).
- [ ] 4.2 Does treasury/structures feed growth (the produce→grow loop)? **Open.**
- [ ] 4.3 Consumption model (flat per-tier vs per-capita)? **Open** (gates 3.2).
- [x] 4.4 tier→output tables — **settable config** (`configureEvolution`), defaults shipped.

## 5. Tests & docs
- [x] 5.1 Pure unit tests (`test/evolution.test.js`).
- [~] 5.2 Live: metric→tier→caps→clamp (`tests/evolution.spec.js`, skips w/o GM seat); merchant-attraction/benefit-gate live cases TODO.
- [ ] 5.3 Update `KEEP.md` / `MERCHANT.md` with the tier model + couplings.

# Tasks — Keep Evolution

## 1. Tier model & metrics
- [x] 1.1 Ground in `KEEP.md` (hamlet→city tiers; metrics: membership, area, order) +
  PF2e Kingmaker size/level prior art + the output/merchant tier stubs.
- [ ] 1.2 Pure `computeTier(metrics, table)` — highest tier whose minimums are all met.
- [ ] 1.3 Metric map on the Keep: membership (derived = roster count), area, order;
  extensible by content. Decide whether treasury/structures feed it.
- [ ] 1.4 Default threshold table (`KEEP.md` brackets), overridable per world.

## 2. Recompute engine
- [ ] 2.1 Recompute tier on metric change (membership add/remove, area/order edit),
  authoritative GM only; write the `tier` flag.
- [ ] 2.2 Emit a `tierChanged` hook when the tier moves; event-driven, never blocks the tick.
- [ ] 2.3 Optional cheap tick backstop re-check.

## 3. Tier → economy outputs
- [ ] 3.1 Per-tier **storage capacity** table → push to `api.rules.setCapacities` on `tierChanged`.
- [ ] 3.2 Per-tier **consumption** scaling (decide flat vs per-capita) → upkeep rules.
- [ ] 3.3 Per-tier **merchant attraction** (count/capacity/rarity/cadence) the merchant
  system reads.
- [ ] 3.4 **Benefit tier-gate** — a benefit def may require a minimum tier.

## 4. Decisions
- [ ] 4.1 Tier-from-metrics rule: minimum-across-brackets (proposed) vs. weighted vs.
  per-metric tiers.
- [ ] 4.2 Does treasury/structures feed growth (the produce→grow loop)?
- [ ] 4.3 Consumption model (flat per-tier vs per-capita).
- [ ] 4.4 Where the tier→output tables live (constants vs settable config).

## 5. Tests & docs
- [ ] 5.1 Pure unit tests: `computeTier` brackets/edges; tier→table lookups.
- [ ] 5.2 Live: metric change → tier moves → caps/merchant params update; tier-gated benefit.
- [ ] 5.3 Update `KEEP.md` / `MERCHANT.md` with the tier model + couplings.

# Tasks — Resource Output System

## 1. Research & model
- [x] 1.1 Survey prior art — PF2e Kingmaker commodities (caps by size, excess lost,
  trade→RP, consumption, storage structures); recorded in `design.md` (2026-06-29).
- [x] 1.2 Define the ordered sink pipeline (consume → convert → store → sell → overflow).
- [ ] 1.3 Decide the **currency model** — abstract treasury vs. Fabricate real coins.
- [ ] 1.4 Decide **overflow default** (`lost` vs `buffered`) and capacity granularity
  (per-resource vs shared warehouse).

## 2. Storage & overflow
- [ ] 2.1 Per-resource capacity model, tier-scaled, with storage upgrades.
- [ ] 2.2 Clamp stored amounts to capacity in the tick flow (respecting the
  projection ownership invariant for Fabricate-managed keys).
- [ ] 2.3 Overflow policy (`lost` | `buffered` via `system.buffers` | `auto-sold`).

## 3. Sale sink (forces merchants — follow-on)
- [ ] 3.1 Define the merchant **buy** interface: resource → price → currency.
- [ ] 3.2 Wire surplus/auto-sell → currency; respects the chosen currency model.
- [ ] 3.3 Hand off full merchant build (attraction, restock, sell-to-player) to a
  merchants change (`MERCHANT.md`, #25).

## 4. Evolution coupling (forces town evolution — follow-on)
- [ ] 4.1 Tier → capacity / consumption / merchant attraction mapping.
- [ ] 4.2 Surplus + built capacity → tier-growth contribution.
- [ ] 4.3 Hand off tier-metric computation to a Keep-evolution change
  (`KEEP.md`, #25, #20).

## 5. Integration & tests
- [ ] 5.1 Slot the sink pipeline into the tick rules engine after producers/converters.
- [ ] 5.2 Pure unit tests for caps/overflow/sale routing.
- [ ] 5.3 Docs: update `KEEP.md` / `MERCHANT.md` with the output model.

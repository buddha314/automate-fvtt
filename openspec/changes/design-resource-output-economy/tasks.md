# Tasks — Resource Output System

## 1. Research & model
- [x] 1.1 Survey prior art — PF2e Kingmaker commodities (caps by size, excess lost,
  trade→RP, consumption, storage structures); recorded in `design.md` (2026-06-29).
- [x] 1.2 Define the ordered sink pipeline (consume → convert → store → sell → overflow).
- [x] 1.3 **Currency model — resolved (2026-06-29): Fabricate currency profiles
  (real coins), `spendStrategy: actorProperty`.** Treasury is a numeric property on
  the Keep actor; sales credit and crafting costs debit one shared pool (design
  Decision 3).
- [x] 1.4 **Overflow default — resolved: `lost`** (Kingmaker prior art; configurable
  per `setOverflowPolicy`). Capacity granularity: **per-resource** (`setCapacities`),
  configurable; tier-scaling is the evolution follow-on.

## 2. Storage & overflow  ✅ BUILT
- [~] 2.1 Per-resource capacity model (`rules.setCapacities`, `output-pipeline.js`).
  Built; **tier-scaling + storage upgrades** are the evolution follow-on.
- [x] 2.2 Clamp stored amounts to capacity in the tick flow (`applyOutputPipeline`);
  Fabricate-managed keys honor the invariant via `adapter.removeComponentUnits` so
  the cap holds against the next projection.
- [x] 2.3 Overflow policy (`lost` | `buffered` via `system.buffers.overflow` |
  `auto-sold` → merchant price → treasury). Pure logic + tick wiring; live-tested.

## 3. Sale sink (forces merchants — built in #48/#49/#50)
- [x] 3.1 Merchant **buy** interface: `merchant.buys` (resource → price); `api.merchants.sellSurplus`.
- [x] 3.2 `auto-sold` overflow → treasury (the Keep currency pool at
  `flags.automate-fvtt.keep.treasury`, the `actorProperty` a Fabricate profile points
  at). Crafting-cost debit from the same pool is the Fabricate-currency wiring follow-on.
- [x] 3.3 Full merchant build (restock, buy/sell, member discounts) landed (#48–#50).

## 4. Evolution coupling (forces town evolution — follow-on)
- [ ] 4.1 Tier → capacity / consumption / merchant attraction mapping.
- [ ] 4.2 Surplus + built capacity → tier-growth contribution.
- [ ] 4.3 Hand off tier-metric computation to a Keep-evolution change
  (`KEEP.md`, #25, #20).

## 5. Integration & tests
- [x] 5.1 `applyOutputPipeline` slotted into the tick after producers/converters/projection.
- [x] 5.2 Pure unit tests (`test/output-pipeline.test.js`) + live (`tests/output-pipeline.spec.js`).
- [x] 5.3 Docs: KEEP.md / MERCHANT.md updated + new docs/ECONOMY.md (loop, status, API, open decisions).

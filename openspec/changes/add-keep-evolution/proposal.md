# Add Keep Evolution (tiers drive the economy)

## Why

Two built subsystems already *read* a Keep's tier but get only a flat default:
the **output pipeline** (#46/#51) scales storage capacity by tier, and the
**merchant system** (#48–#50) scales attraction/capacity/restock by tier. Nothing
computes that tier yet. `KEEP.md` describes the progression — Keeps tranched into
hamlet → village → … → city → megacity by metrics, with benefits escalating per tier
— but there is no **evolution engine**.

Building it lights up the tier-scaling stubs across the economy and closes the
**virtuous loop**: produce → sell → grow (treasury/members/structures) → higher tier →
bigger caps, more/better merchants, stronger benefits → produce more.

## What Changes

- **A tier model** — a Keep's **tier** computed from its **metrics** (membership size,
  land area, lawfulness/order — `KEEP.md`) via a **data-driven threshold table**
  (hamlet/village/shire/town/city/…). Single numeric tier to start; per-metric tiers
  ("city in area, hamlet in population") noted as future.
- **Event-driven recompute** — tier is recomputed when a metric changes (membership,
  area, …) and stored on the Keep (`tier` flag), mirroring the benefits engine's
  event model. Never blocks a clock fast-forward.
- **Tier → economy outputs** — tier supplies the real values the stubs consume:
  storage **capacities** (feeding `setCapacities`), baseline **consumption** (upkeep),
  and **merchant attraction** (count/capacity/rarity/cadence). Benefits MAY gate on tier.

## Impact

- **Specs:** new `keep-evolution` capability.
- **Reuses:** the existing `tier` field on the Keep, the benefits-engine event pattern
  + data-driven tables, and the metric stores (membership already on the flag).
- **Feeds:** the output pipeline (#46/#51 caps), merchants (#48–#50 attraction), and
  benefits (tier gating). Prior art / coordination: PF2e Kingmaker kingdom size/level,
  the Kingdom Builder review (#20), Keep mechanics (#25).

## Non-goals

- **Per-metric multi-tiers** ("city in area but hamlet in population") — single tier
  first; multi-metric is a future extension.
- Measuring the **raw metrics themselves** (e.g. land-area surveying) — evolution reads
  metrics; their authoring/sourcing is separate.
- Re-implementing caps/merchants/benefits — evolution only **supplies tier** to them.

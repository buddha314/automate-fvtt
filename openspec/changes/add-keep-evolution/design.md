# Design — Keep Evolution

## Context

The output pipeline (#46/#51) and merchants (#48–#50) both scale by **Keep tier** but
read a flat default — nothing computes tier. `KEEP.md` defines the progression
(hamlet → … → city → megacity by metrics; benefits escalate per tier). This change
computes tier and feeds it to those subsystems. PF2e Kingmaker (kingdom **size** →
**level**, with size brackets) is direct prior art.

## Decision 1 — A single numeric tier computed from metrics (per-metric tiers later)

A Keep has one **tier** (an integer/level). It is **derived**, not hand-set: a pure
function maps the Keep's metrics to a tier via a threshold table. `KEEP.md` floats
per-metric tiers ("city in area but hamlet in population") — deferred; we start with
one tier (e.g. the **minimum** across metric brackets, the conservative reading) and
keep the door open. The existing `tier` flag on the Keep stores the result.

## Decision 2 — Metrics are data-driven and extensible

Seed metrics from `KEEP.md`: **membership size** (roster count — already on the flag),
**land area**, **lawfulness/order**. Metrics are a `{ key: value }` map on the Keep so
content/systems can add their own (treasury, structures, population). Some are derived
(membership = `members.length`); others are GM/content-set (area, order).

## Decision 3 — Tier thresholds are a data-driven table

```
   tierTable = [
     { tier: 0, name: "hamlet",  min: { population: 0,    area: 0   } },
     { tier: 1, name: "village", min: { population: 100,  area: 1   } },
     { tier: 2, name: "town",    min: { population: 1000, area: 20  } },
     { tier: 3, name: "city",    min: { population: 10000, area: 100 } },
     …
   ]
   tier(metrics) = highest table row whose every `min` the metrics meet
```

Default brackets ship (`KEEP.md`'s examples), fully overridable per world/system —
the same data-driven posture as the benefits cookbook. The computation is **pure**
and unit-testable.

## Decision 4 — Event-driven recompute, stored on the Keep

Mirror the benefits engine: recompute tier when a **metric changes** (membership add/
remove, an area/order edit) on the authoritative GM, write it to the `tier` flag, and
fire a `tierChanged` hook when it moves. Never participates in the economy tick — it
settles once at the event/landing point, so it never blocks a fast-forward. (A tick
re-check is a cheap optional backstop.)

## Decision 5 — Tier supplies the values the stubs consume

Tier is an **input** the economy subsystems read; evolution publishes the mapping:

| Consumer | What tier supplies |
|---|---|
| Output caps (#46/#51) | per-resource **storage capacity** by tier → `api.rules.setCapacities` |
| Consumption (upkeep) | baseline **consumption** scaling (more residents eat more) |
| Merchants (#48–#50) | merchant **count / capacity / rarity bias / restock cadence** |
| Benefits | optional **tier gate** (a benefit available at tier ≥ N) |

These mappings are themselves data-driven tables keyed by tier. Evolution writes/
exposes them; the consumers already read tier (they get real values instead of a flat
default). Capacities specifically: on `tierChanged`, recompute and push the Keep's
caps.

## Decision 6 — Reuse, don't reinvent

- The **`tier` flag** already exists (added with membership/benefits).
- The **benefits-engine event pattern** (auto recompute on change, authoritative-GM
  writer, hooks) and its **data-driven table** style.
- **Membership** as a metric source; the **rules engine** for any tick backstop.
- System-agnostic: metrics, thresholds, and tier→output tables are all data.

## Risks

- **Thrashing** — tier flipping on small metric jitter; mitigate with the table's
  monotone brackets (and optionally hysteresis later).
- **Coupling order** — caps/merchants read tier; evolution must publish before they
  act. A `tierChanged` → recompute-caps push keeps it one-way.
- **Multi-metric ambiguity** — the "min across brackets" rule is conservative; revisit
  when per-metric tiers land.
- **Metric authorship** — area/order need a source; until then they default (so a Keep
  is hamlet-tier until a GM sets metrics).

## Open questions

- **Tier from metrics** — minimum across brackets (conservative, chosen) vs. a weighted
  score vs. per-metric tiers from day one?
- **What feeds growth** — pure metrics (population/area), or also **treasury/structures**
  (the produce→grow loop)? Likely add treasury as an optional metric.
- **Consumption model** — flat per-tier vs. per-capita (membership × rate)?
- **Where the tier→output tables live** — constants/defaults vs. a settable config.

## Coordinate

Feeds #46/#51 (caps), #48–#50 (merchants), benefits (gating). `KEEP.md` (tiers) +
`MERCHANT.md` (attraction) — update when this lands. Kingdom Builder review (#20),
Keep mechanics (#25).

# Design a Resource Output System (where produced resources go)

## Why

Rung 1 proved a Keep can **produce** resources (gather/craft → stockpile). But the
stockpile today is an **unbounded ledger** — ore just piles up forever. That's not an
economy. We need an **output system**: a defined answer to *"a Keep produces ore —
where does it go?"*

Answering it forces two subsystems we've sketched but not built:
- **Merchants** — the path by which **surplus becomes currency** (sell ore you can't
  use). Without a sale sink, production has no economic point.
- **Town/Keep evolution** — **storage capacity, consumption, and merchant
  attraction scale with tier**, and surplus/structures drive tier growth. Without
  it, there's no pressure on output and no progression.

PF2e Kingmaker's kingdom economy is direct prior art (our target system, ORC):
commodities have **storage caps by size, excess is lost**, sinks are
**build/consume/trade-for-currency**, and **storage structures raise caps** as the
kingdom grows. This change researches and designs our equivalent.

## What Changes

- **An output pipeline** for produced resources: a defined, ordered set of **sinks** —
  consume (upkeep) → convert (craft) → store (capped) → **sell (merchant → currency)**
  → overflow policy — instead of unbounded accumulation.
- **Storage capacity** per resource, scaled by Keep tier/size, with a configured
  **overflow policy** (lost / buffered / auto-sold).
- **The merchant sale path** as the surplus→currency sink (forces `MERCHANT.md`).
- **Evolution coupling**: tier sets caps/consumption/merchant attraction; surplus +
  built capacity drive tier growth (forces `KEEP.md` tiers/evolution).

This change is **research/design (spec) only** — it defines the model and its forced
consequences; building merchants and evolution are follow-on changes.

## Impact

- **Specs:** new `resource-output-economy` capability.
- **Reuses:** the stockpile + `buffers` (port delivery), the rules engine, benefits,
  and Fabricate currency profiles — don't reinvent.
- **Forces / connects:** merchants (`MERCHANT.md`, #25), Keep evolution
  (`KEEP.md`, #25), and the Kingdom Builder review (#20). Feeds the economy rungs of
  epic #41; Rung 2 (gathering) supplies the production this consumes.

## Non-goals

- Implementing merchants or the evolution/tier engine (separate changes this forces).
- Building the currency plumbing — the **model is decided (Fabricate currency
  profiles / real coins)**, but wiring sales+costs to it is a follow-on.
- Re-deriving production (gathering/crafting already covered).

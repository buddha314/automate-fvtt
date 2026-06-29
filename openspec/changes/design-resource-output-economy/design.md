# Design — Resource Output System

## Context

Production exists (gather/craft → stockpile); the **sink** layer doesn't. The
stockpile is an unbounded numeric ledger (plus Fabricate component items), so output
has nowhere meaningful to go. This design defines where it goes — and in doing so
forces merchants and Keep evolution.

## Prior art — PF2e Kingmaker kingdom economy

Our target system, ORC-licensed, and a close fit:
- **Commodities** (Food, Lumber, Luxuries, Ore, Stone) are stockpiled.
- **Storage capacity by Size**; **commodities gathered in excess of the cap are lost**
  unless storage structures are built (a foundry raises Ore cap, a lumberyard raises
  Lumber cap).
- **Sinks**: build structures (consume commodities), **Trade Commodities → Resource
  Points** (an abstract currency), and event/famine/war expenditure.
- **Consumption**: Food is expended each turn for upkeep.

Sources: Kingdom Rules https://2e.aonprd.com/Rules.aspx?ID=1781 · Commodities
https://2e.aonprd.com/Rules.aspx?ID=1790 · rpgbot guide
https://rpgbot.net/p2/kingmaker-kingdom-rules-guide/

## Decision 1 — Output resolves through an ordered sink pipeline

A produced unit of a resource flows through sinks in priority order; whatever a sink
can't absorb falls through to the next:

```
   PRODUCE (gather/craft)
        │
        ▼
   1. CONSUME    upkeep / maintenance draws (existing consumer/upkeep rules)
   2. CONVERT    feed crafting recipes (existing converter rules / Fabricate)
   3. STORE      into the stockpile, up to a per-resource CAPACITY (Decision 2)
   4. SELL       surplus → currency via a MERCHANT (Decision 3)
   5. OVERFLOW   whatever remains → policy: lost | buffered | auto-sold (Decision 2)
```

This generalizes the current behavior (everything → unbounded store) into a model
where storage is bounded and surplus has somewhere to go. The existing tick rules
engine already orders producers/consumers/converters; this adds store-cap + sell +
overflow as the tail.

## Decision 2 — Storage capacity + overflow policy, scaled by tier

- Each managed resource has a **capacity** (per Keep). Default capacity scales with
  **Keep tier/size** (Decision 4), and **storage upgrades** raise it (Kingmaker's
  foundry/lumberyard pattern).
- **Overflow policy** (configurable, per resource or Keep): `lost` (Kingmaker
  default), `buffered` (hold in the existing `system.buffers` port holds for later
  routing/collection), or `auto-sold` (route to the merchant sink immediately).
- Reuses the existing `buffers` structure (port delivery) as the natural home for
  `buffered` overflow.

## Decision 3 — The merchant sale path (surplus → currency)

This is the sink that **forces merchant development**. Surplus that exceeds storage
(or is flagged for sale) is **sold to a merchant for currency**:
- A merchant attached to the Keep buys configured resources at a price, converting
  surplus into the Keep's **currency**.
- **Currency model — resolved: Fabricate currency profiles (real coins).** The Keep's
  treasury is concrete currency held/spent via Fabricate's currency profile
  (`requirements.currency`: `spendStrategy` `actorProperty` | `actorInventory` |
  `macro`, with `units`). A merchant **sale credits** that currency; Fabricate
  crafting **costs debit** the same pool — one consistent money model end to end
  (vs. an abstract Kingmaker-style RP treasury, which we rejected for not integrating
  with crafting costs). The merchant is the seam between resources and money.
- Pairs with `MERCHANT.md`: merchants are attracted by Keep metrics, restock, and now
  also **buy** surplus — closing production → currency.

## Decision 4 — Evolution coupling (tier drives, and is driven by, output)

This is the sink/loop that **forces town evolution**:
- **Tier → economy**: a Keep's tier/size sets storage **capacity**, baseline
  **consumption**, and **merchant attraction** (bigger Keeps store more, consume more,
  attract more/better merchants — `KEEP.md` tiers, `MERCHANT.md` attraction).
- **Output → tier**: accumulated surplus / built storage + production capacity feed
  **tier growth** (and structures consume commodities to build — a sink). The virtuous
  loop: produce → surplus → sell/build → grow → bigger caps + better merchants.
- Ties to `KEEP.md` (hamlet→city tiers, benefits escalate with tier) and the Kingdom
  Builder review (#20).

## Decision 5 — Reuse existing machinery; stay system-agnostic

- Stockpile + `buffers` (storage + overflow holds), the rules engine
  (producers/consumers/converters already ordered), benefits (tier-scaled effects),
  and **Fabricate currency profiles** (if real coins) — compose these; don't rebuild.
- Keep resource/commodity sets data-driven so any world/system defines its own.

## Risks

- **Currency model fork** (abstract treasury vs Fabricate real coins) ripples into
  merchants and crafting costs — decide early.
- **Overflow-loss feel-bad** — `lost` is punishing; `buffered`/`auto-sold` soften it.
  Make it policy, not hard-coded.
- **Scope creep** — this design forces two big subsystems (merchants, evolution);
  keep them as separate follow-on changes with this as the spine.
- **Ownership invariant** — Fabricate-managed resource keys are overwritten by
  projection each sync; caps/overflow must act on the projected totals, not fight them.

## Open questions

- **Currency:** **resolved (Decision 3) — Fabricate currency profiles (real coins)**,
  so sales and crafting costs share one money pool. Sub-question: which
  `spendStrategy` (`actorProperty` vs `actorInventory`) the Keep's treasury uses by default.
- **Capacity granularity:** per-resource caps, a shared warehouse pool, or both?
- **Overflow default:** `lost` (Kingmaker) vs `buffered` (gentler) as our default?
- **Tier computation:** which metrics (population, area, surplus, structures) and how
  they map to tier — overlaps #20/#25; coordinate.
- **Sale automation:** auto-sell-on-overflow vs a GM/merchant restock cadence.

## What this forces (follow-on changes)

- **Merchants** — buy/sell, attraction, restock (`MERCHANT.md`, #25).
- **Keep evolution** — tier metrics + escalation (`KEEP.md`, #25, #20).
- **Currency** — Fabricate currency profiles (real coins); wire the merchant sale to
  credit the Keep's currency and confirm crafting costs debit the same pool.

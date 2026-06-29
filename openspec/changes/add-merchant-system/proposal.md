# Add the Merchant System (the surplus → currency sink)

## Why

The output-economy design (#46) defines a **sale sink** — surplus resources a Keep
can't use are sold for currency — but leaves the seller unbuilt. That seller is the
**merchant**. Merchants are also the player-facing buy side (shop at the Keep) and a
core Keep benefit (`KEEP.md`: bigger Keeps attract merchants and discount goods).
`MERCHANT.md` sketches the concept (types, attraction, restock, weighted stock) but
there is no **merchant class** or mechanics.

Building merchants closes the economy loop — **gather → craft → store → SELL →
currency** — and gives production an economic point. It also surfaces the
**evolution** coupling: a Keep's tier drives which merchants it attracts and how
often they restock.

## What Changes

- **A Merchant class** — a typed record bound to a Keep (`smith | alchemist |
  tinkerer | trader | …`, content-defined), with capacity, stock, prices, restock
  rules, and a buy list.
- **Restocking** — on a Keep-driven cadence, regenerate stock by **weighted random
  selection** (multinomial inverse-to-value, per `MERCHANT.md`) from a candidate
  list, up to capacity; capacity/rarity/cadence scale with Keep tier.
- **Buy side (the output sink)** — a merchant **buys** configured surplus resources at
  a price, crediting the Keep's currency (the #46 sale sink, made concrete).
- **Sell side** — players buy from merchant stock, debiting currency; **member
  benefits** (`KEEP.md`) apply discounts.
- **Attraction** — merchants are recruited/attracted to a Keep by its metrics/tier
  (the evolution coupling).
- **Currency** — Fabricate currency profiles (`actorProperty`), per the #46 decision.

## Impact

- **Specs:** new `merchants` capability.
- **Reuses:** the benefits subsystem's data-driven pattern (definitions + cookbook +
  importers), the Keep flag store (like membership), the rules-engine tick (restock
  cadence), **Fabricate currency** + **Item Piles** (shop surface), and the #46 sink.
- **Connects / forces:** the output economy (#46), Keep evolution (tier ↔ attraction —
  `KEEP.md`, #25, #20), and member benefits (discounts).

## Non-goals

- The **evolution/tier engine** itself (a separate change — merchants only *read* tier).
- Currency plumbing internals (the model is decided in #46; merchants use it).
- A bespoke shop UI if **Item Piles** covers it — integrate, don't rebuild.
- Authoring specific merchant content (an example merchant rides the example-tree work, #38).

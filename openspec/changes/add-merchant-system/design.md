# Design — Merchant System

## Context

The economy now produces (gather/craft → stockpile) but surplus has no destination.
The output design (#46) routes surplus to a **sale sink → currency**; this change
builds that seller — the merchant — plus the player buy side and the tier-driven
attraction `MERCHANT.md` and `KEEP.md` describe. Currency is decided (#46): Fabricate
currency profiles, `spendStrategy: actorProperty`.

## Decision 1 — The Merchant class (data model)

A merchant is a typed record **bound to a Keep**, stored under the Keep flag
(alongside members), system-agnostic and JSON-authorable:

```js
Merchant = {
  id,                       // stable id
  type,                     // content-defined string: "smith"|"alchemist"|"tinkerer"|"trader"|…
  name,
  capacity,                 // max stock slots (scales with tier — Decision 6)
  stock: [                  // current inventory (regenerated on restock — Decision 3)
    { itemUuid, quantity, price }     // price in the Keep currency's units
  ],
  restock: {                // Decision 3
    intervalSeconds,        // cadence (a function of the Keep — MERCHANT.md)
    candidates: [{ itemUuid, baseValue, weight? }],  // pool to draw from
    weighting: "inverseValue",        // multinomial ∝ 1/value (MERCHANT.md); or "uniform"|"explicit"
    rarityBias,             // higher tier/capacity → more rare (higher-value) items
    lastRestockAt
  },
  buys: [                   // the OUTPUT SINK (Decision 4)
    { resourceKey, price }  // resources this merchant buys, and the per-unit price
  ],
}
```

`type` is an **opaque vocabulary** (like benefit roles) — content defines smith/
alchemist/tinkerer/trader and what each carries; the engine doesn't hardcode them.

## Decision 2 — Where merchants live: Keep flag record + optional Item Piles shop

- **State** lives on the Keep flag (`flags["automate-fvtt"].keep.merchants[]`), the
  same store pattern as membership — no extra document type, pf2e-safe.
- **Shop surface** is **Item Piles** when present (Fabricate already ships
  `ItemPilesIntegration`): project a merchant's `stock` into an Item Piles *merchant
  actor* for the buy/sell UI, and degrade to a simple list/sheet when absent. We
  don't build a bespoke shop UI if Item Piles covers it (integration contract).

## Decision 3 — Restock: weighted random draw on a Keep-driven cadence

On its `intervalSeconds` (a tick-driven cadence, a function of the Keep — bigger
Keeps restock more often), regenerate `stock`:
- Draw up to `capacity` items **with replacement** from `restock.candidates`, weighted
  **inversely to value** by default (`p ∝ 1 - value/Σvalue`, normalized — the
  `MERCHANT.md` multinomial), so cheap goods are common and rare goods scarce.
- `rarityBias` (from tier/capacity) shifts weight toward higher-value items as the
  Keep grows — "as capacity increases, probability of rarer items increases."
- Pure, seedable selection so a multiplayer world restocks identically on the
  authoritative GM (mirror the rules-engine single-writer guard).
- Data-driven: ship restock rules as JSON / a cookbook, like the benefits importers.

## Decision 4 — Buy side: the output sink (surplus → currency)

This is the concrete form of #46's sale sink. A merchant's `buys` list names resources
it purchases at a price; surplus routed to the sale sink (or sold manually) is:
- consumed from the Keep stockpile, and
- credited to the Keep's **Fabricate currency** (`actorProperty` treasury, #46).

Crafting costs debit the *same* currency pool — one money model. Auto-sell-on-overflow
(the `auto-sold` overflow policy in #46) routes here.

## Decision 5 — Sell side: players buy; members get discounts

- A player/PC buys an item from the merchant's `stock`: debit the buyer's currency
  (or the Keep treasury, per context), remove/decrement stock, grant the item.
- **Member benefits apply**: a Keep member with a "discounted goods" benefit
  (`KEEP.md`, the benefits subsystem) gets a price modifier — reuse
  `api.benefits` modifiers (e.g. a `merchant.priceMultiplier` key), not a new system.

## Decision 6 — Attraction & capacity scale with Keep tier (evolution coupling)

Merchants are **attracted/recruited by Keep metrics/tier** (`MERCHANT.md`, `KEEP.md`):
- Tier sets how many merchants a Keep supports, their `capacity`, `rarityBias`, and
  restock cadence (bigger → more/better/faster).
- This is the seam to **Keep evolution** (a separate change owns tier computation);
  merchants only **read** tier and react.

## Decision 7 — Reuse, don't reinvent

- **Benefits pattern** for the data model: definitions + `cookbook` defaults +
  `importers` (license-permissive content → merchant rules for GM review).
- **Keep flag store** for state; **rules-engine tick** for the restock cadence and
  auto-sell; **Fabricate currency** for money; **Item Piles** for the shop UI.
- System-agnostic: resources, item refs, types, and prices are all data.

## Risks

- **Item Piles optionality** — must degrade cleanly when absent (integration contract);
  don't hard-depend.
- **Multiplayer determinism** — randomized restock must be single-writer + seedable or
  clients diverge.
- **Currency edge cases** — buyer can't afford; merchant out of stock; price rounding
  in the chosen currency units.
- **Scope** — attraction depends on tier, which is the evolution change; keep the
  dependency one-way (read tier) so this can land before evolution with a flat default.

## Open questions

- **Merchant identity** — pure Keep-flag record (chosen) vs. a first-class Foundry
  actor. Item Piles wants an actor for the shop; do we keep the record canonical and
  project to a transient actor, or make the actor canonical?
- **Who holds sale currency** — the Keep treasury (chosen default) vs. the buying PC's
  own coins for player purchases.
- **Restock model** — strictly `MERCHANT.md`'s inverse-value multinomial, or also
  support roll-table / explicit-list strategies from day one?
- **Attraction default** before evolution exists — a flat "one merchant, fixed
  capacity" until tier metrics land.

## Coordinate

Output economy (#46) — the sink this implements. Keep evolution (#25, #20) — supplies
tier. Benefits subsystem — discounts + the data-model pattern. `MERCHANT.md` /
`KEEP.md` — the concept; update them when this lands.

# Tasks — Merchant System

## 1. Model & store
- [x] 1.1 Ground in `MERCHANT.md` (types, attraction, capacity, restock, inverse-value
  stocking) + the #46 sale sink + currency decision (Fabricate `actorProperty`).
- [ ] 1.2 Define the Merchant record (id, type, name, capacity, stock[], restock{}, buys[]).
- [ ] 1.3 Store merchants under the Keep flag (membership-store pattern); CRUD on the API.
- [ ] 1.4 Decide merchant identity — canonical Keep-flag record vs. first-class actor
  (Item Piles wants an actor for the shop).

## 2. Restock
- [ ] 2.1 Pure weighted-draw util: multinomial inverse-to-value, with-replacement, to capacity.
- [ ] 2.2 Rarity bias from tier/capacity; pluggable strategies (inverseValue | uniform | explicit).
- [ ] 2.3 Tick-driven cadence (function of the Keep); single authoritative writer + seedable.
- [ ] 2.4 Data-driven restock rules (JSON / cookbook), like the benefits importers.

## 3. Buy side (the output sink — #46)
- [ ] 3.1 `buys` list → consume stockpile resource, credit Keep Fabricate currency.
- [ ] 3.2 Wire the #46 `auto-sold` overflow policy to route surplus here.

## 4. Sell side
- [ ] 4.1 Player buy from stock: debit currency, decrement stock, grant item.
- [ ] 4.2 Member discount via `api.benefits` modifier (e.g. `merchant.priceMultiplier`).
- [ ] 4.3 Afford/out-of-stock/rounding edge cases.

## 5. Attraction & evolution coupling
- [ ] 5.1 Tier → merchant count / capacity / rarity / cadence (read tier only).
- [ ] 5.2 Flat default until the evolution change supplies tier metrics (#25, #20).

## 6. Item Piles & UI
- [ ] 6.1 Project stock to an Item Piles shop when present (Fabricate `ItemPilesIntegration`).
- [ ] 6.2 Built-in fallback list/sheet; graceful when Item Piles absent (integration contract).

## 7. Tests & docs
- [ ] 7.1 Pure unit tests: weighted draw distribution, discount math, buy/sell accounting.
- [ ] 7.2 Live test: restock on tick, sell surplus → currency, member discount.
- [ ] 7.3 Update `MERCHANT.md` / `KEEP.md`; note the #46 + evolution couplings.

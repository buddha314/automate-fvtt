# Tasks — Merchant System

## 1. Model & store
- [x] 1.1 Ground in `MERCHANT.md` (types, attraction, capacity, restock, inverse-value
  stocking) + the #46 sale sink + currency decision (Fabricate `actorProperty`).
- [x] 1.2 Define the Merchant record (`makeMerchant` — id, type, name, capacity,
  stock[], restock{}, buys[]) — `merchants/merchants.js`.
- [x] 1.3 Store merchants under the Keep flag + CRUD (`merchants/merchant-engine.js`,
  `api.merchants.{list,get,add,remove,restock}`; `merchants` field on KeepModel).
- [x] 1.4 Merchant identity — **canonical Keep-flag record** (chosen, built); an
  Item Piles shop actor stays an optional projection (task 6.1, deferred).

## 2. Restock
- [x] 2.1 Pure weighted-draw util — multinomial inverse-to-value, with-replacement,
  to capacity (`candidateWeights`/`pickWeighted`/`restockStock`); unit-tested.
- [x] 2.2 Rarity bias + pluggable strategies (inverseValue | uniform | explicit).
- [x] 2.3 Tick-driven cadence + authoritative-GM single writer (broadcast via the
  actor update, so no seeded RNG needed) — `registerMerchantEngine`.
- [ ] 2.4 Data-driven restock rules (JSON / cookbook), like the benefits importers.

## 3. Buy side (the output sink — #46)
> **Treasury resolved (2026-06-29):** the Keep treasury is a numeric pool at
> `flags["automate-fvtt"].keep.treasury` (system-agnostic) — the `actorProperty`
> location a Fabricate currency profile points at, so crafting costs share the pool.
- [x] 3.1 `buys` list → consume stockpile resource, credit Keep treasury
  (`sellSurplusToMerchant`, `api.merchants.sellSurplus`).
- [ ] 3.2 Wire the #46 `auto-sold` overflow policy to route surplus here (needs the
  output pipeline; for Fabricate-managed keys, item-level consumption too).

## 4. Sell side
- [x] 4.1 Buy from stock: decrement stock, credit treasury with the take
  (`buyFromMerchant`, `api.merchants.buy`). Granting the item + debiting the buyer's
  own coins is left to the caller / Item Piles (system-specific).
- [x] 4.2 Member discount via the `merchant.priceMultiplier` benefit modifier
  (`getMemberModifier`).
- [x] 4.3 Out-of-stock + price clamping handled; afford-check on the buyer is caller-side.

## 5. Attraction & evolution coupling
- [ ] 5.1 Tier → merchant count / capacity / rarity / cadence (read tier only).
- [ ] 5.2 Flat default until the evolution change supplies tier metrics (#25, #20).

## 6. Item Piles & UI
- [ ] 6.1 Project stock to an Item Piles shop when present (Fabricate `ItemPilesIntegration`).
- [ ] 6.2 Built-in fallback list/sheet; graceful when Item Piles absent (integration contract).

## 7. Tests & docs
- [x] 7.1 Pure unit tests for the weighted draw + model (`test/merchants.test.js`);
  discount/buy/sell accounting deferred with §3/§4.
- [x] 7.2 Live test: merchant CRUD + restock-to-capacity AND sell-surplus→treasury +
  buy→treasury/stock-down (`tests/merchant.spec.js`). Member-discount path is wired
  (unit-tested via `discountedPrice`); a live member-discount case is still TODO.
- [ ] 7.3 Update `MERCHANT.md` / `KEEP.md`; note the #46 + evolution couplings.

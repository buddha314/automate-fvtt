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

## 3. Buy side (the output sink — #46)  ⛔ DESIGN CHOKE POINT
> Blocked on currency plumbing: the #46 output system isn't built, and *where the Keep
> treasury lives* (the `actorProperty` path on the flag-backed Keep) is undecided.
> Restock/CRUD (currency-free) are built; buy/sell wait on this.
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
- [x] 7.1 Pure unit tests for the weighted draw + model (`test/merchants.test.js`);
  discount/buy/sell accounting deferred with §3/§4.
- [~] 7.2 Live test: merchant CRUD + restock-to-capacity (`tests/merchant.spec.js`);
  sell surplus → currency + member discount deferred with §3/§4.
- [ ] 7.3 Update `MERCHANT.md` / `KEEP.md`; note the #46 + evolution couplings.

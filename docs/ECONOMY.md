# The Keep Economy — status & reference

A single place to see how the Keep economy fits together, what is **built** vs.
**deferred**, the **open decisions**, and the **public API**. The formal,
requirement-level specs live as OpenSpec changes under `openspec/changes/*`
(archived into `openspec/specs/*` as each completes); this doc is the living
overview for resuming work later. (Status as of 2026-06-29.)

## The loop

```
   gather ──▶ stockpile ──▶ craft ──▶ stockpile ──▶ STORE (tier-capped)
     ▲                                                   │
     │                                          overflow │  lost | buffered | auto-sold
     │                                                   ▼
   (tier raises caps,                              SELL → merchant → TREASURY (currency)
    attracts merchants) ◀────── GROW (tier) ◀──────────┘
```

All tick-driven (world-time advance), written by a single **authoritative GM** and
broadcast to clients. Verified end-to-end by the live Playwright specs.

## Subsystems

| Subsystem | Status | Where | Key API |
|---|---|---|---|
| Tick dispatcher + rules engine | ✅ main | `rules/*`, `time/*` | `api.rules.{register,applyTick,setDelivery}`, `api.time` |
| Keep model (core-type actor + flag) | ✅ main | `keep-api.js`, `data/keep-model.js` | `api.keeps.{create,open,get,list,getData,setResource,setCount}` |
| Membership & benefits | ✅ main | `benefits/*` | `api.keeps.members.*`, `api.benefits.*` |
| Fabricate seam (seed, craft, gather, inventory) | ✅ main | `fabricate-adapter.js`, `fabricate/*` | `api.fabricate.{seedSystem,craft,startGathering,readInventory}` |
| Crafting loop (recipe → items → stockpile) | ✅ main | adapter + `rules/rule-engine.js` | (tick-driven; `api.dev.setupCraftPlaytest`) |
| Gathering loop (env+task → items → stockpile) | ✅ main | adapter + `dev/gather-playtest.js` | `api.dev.setupGatheringPlaytest` |
| **Output pipeline** (caps + overflow) | ✅ main | `rules/output-pipeline.js` | `api.rules.{setCapacities,setOverflowPolicy}` |
| **Merchants** (restock + buy/sell) | ✅ main | `merchants/*` | `api.merchants.{add,restock,sellSurplus,buy}` |
| **Treasury** (currency pool) | ✅ main | `keep-api.js` | `api.keeps.{getTreasury,adjustTreasury}` |
| **Keep evolution** (tier from metrics → caps) | 🔜 PR #53 | `evolution/*` | `api.evolution.{configure,getTier,setMetric}` |
| Example crafting trees (shipped content) | ⛔ planned | — | (#38, #40) |
| Scheduled events / disruptions | ⛔ planned | — | (`add-scheduled-events-calendar`) |
| Canvas node placement (Rung 2b) | ⛔ planned | — | (Fabricate interactables) |

## How money flows

- **Treasury** = a numeric pool at `flags["automate-fvtt"].keep.treasury` — the
  `actorProperty` location a Fabricate currency profile points at, so Fabricate craft
  **costs** can debit the same pool sales **credit** (the cost-side bridge is a TODO).
- **Sell surplus** (`api.merchants.sellSurplus`) and **auto-sold overflow** both
  credit the treasury at the merchant's `buys` price.
- **Player purchase** (`api.merchants.buy`) credits the treasury (the shop's take),
  applies member discounts; granting the item + debiting the buyer's own coins is
  caller/Item-Piles territory.

## Open decisions (for later)

- **Evolution → consumption** — flat per-tier vs. per-capita (gates the upkeep hook).
- **Growth driver** — do **treasury / structures** feed tier metrics (the produce→grow
  feedback), or only population/area?
- **Merchant attraction** — how aggressively tier changes should mutate existing
  merchants (count/capacity/rarity/cadence).
- **Per-metric tiers** — "city in area, hamlet in population" (single tier today).
- **Benefit tier-gate** — wire a benefit's minimum-tier requirement.
- **Merchant identity / shop UI** — canonical flag record vs. an Item Piles actor.
- **Restock strategies** — only inverse-value today; roll-table / explicit later.
- **Managed-resource overflow** — `removeComponentUnits` built; live coverage TODO.
- **Fabricate currency bridge** — point a currency profile at the treasury so craft
  costs debit it.

## Public API (`game.modules.get("automate-fvtt").api`)

- `keeps` — `create, open, get, list, getData, isKeep, setResource, adjustResource,
  removeResource, setCount, getTreasury, setTreasury, adjustTreasury,
  members.{add,remove,setRole,list}, getMemberModifier, memberWithdraw, collectPorts`
- `rules` — `register, unregister, list, makeFabricateRule, setComponentMap,
  setCapacities, setOverflowPolicy, setDelivery, applyTick, FAB_OP, DELIVERY`
- `fabricate` — `seedSystem, exportSystem, importSystem, getSystem, listSystems,
  readInventory, craft, startGathering, removeComponentUnits`
- `merchants` — `list, get, add, remove, restock, sellSurplus, buy`
- `evolution` *(PR #53)* — `configure, getTier, setMetric, recompute, metricsOf`
- `benefits` — `register, unregister, list, bind, unbind, approve, invoke, import`
- `dev` — `setupCraftPlaytest, teardownCraftPlaytest, setupGatheringPlaytest,
  teardownGatheringPlaytest`
- `time` — `open, toggle, onTick`

Hooks: `automate-fvtt.{ready, keepUpdated, tick, membershipChanged, tierChanged,
benefitInvoked, benefitPending}`; consumes `fabricate.gathering.attemptCompleted`.

## Constraints worth remembering

- **Gathering is blocked while the game is paused** (`GAME_PAUSED`) — auto-harvest
  needs an unpaused world. Crafting has no such limit.
- **Crafted/harvested items carry no source reference** — recognized by **name**
  (`component-map.js` matches by source ref *or* name).
- **pf2e forbids module Actor sub-types** — Keeps are core-type actors + a flag.
- **Fabricate loads its built `dist/`** — rebuild after pulling its source.

## Tests

Pure logic is unit-tested (`test/*.test.js`, `npm test`). End-to-end behaviour is
live-tested against a running world (`tests/*.spec.js`, Playwright) and **skips
gracefully** without a licensed Foundry / free GM seat.

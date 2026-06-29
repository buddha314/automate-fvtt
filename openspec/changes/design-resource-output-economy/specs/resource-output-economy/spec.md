# resource-output-economy

## ADDED Requirements

### Requirement: Produced resources resolve through an ordered sink pipeline
The economy SHALL route produced resources through an ordered set of sinks —
consume (upkeep), convert (craft), store (capped), sell (merchant → currency), then
overflow — rather than accumulating without bound. A unit not absorbed by one sink
SHALL fall through to the next.

#### Scenario: Surplus beyond storage reaches the sale/overflow sinks
- **WHEN** a Keep produces more of a resource than upkeep, crafting, and storage absorb
- **THEN** the surplus is offered to the sale sink, then the overflow policy — not silently stored without limit

### Requirement: Bounded storage with tier-scaled capacity
Each managed resource SHALL have a storage capacity per Keep, the default capacity
SHALL scale with the Keep's tier/size, and storage upgrades SHALL raise it. Stored
amounts SHALL NOT exceed capacity.

#### Scenario: Storage caps the stored amount
- **WHEN** production would push a resource above its capacity
- **THEN** the stored amount is clamped to capacity and the excess goes to the overflow handling

#### Scenario: A storage upgrade raises capacity
- **WHEN** a storage upgrade for a resource is added to a Keep
- **THEN** that resource's capacity increases accordingly

### Requirement: Configurable overflow policy
Overflow SHALL be handled by a configured policy — `lost`, `buffered` (held in the
Keep's port buffers), or `auto-sold` (routed to the sale sink) — selectable per Keep
or per resource rather than hard-coded.

#### Scenario: Buffered overflow is retained
- **WHEN** the overflow policy is `buffered` and a resource overflows
- **THEN** the excess is held in the Keep's buffers rather than lost

### Requirement: Surplus sells to a merchant for Fabricate currency
The economy SHALL provide a sale sink that converts surplus resources into the Keep's
currency through a merchant, at configured prices. Currency SHALL be a **Fabricate
currency profile** (real coins) using **`spendStrategy: actorProperty`** (the treasury
is a numeric property on the Keep actor), so a sale credits the same money pool that
Fabricate crafting costs debit — not a separate abstract treasury.

#### Scenario: Selling surplus credits Fabricate currency
- **WHEN** surplus is routed to the sale sink and a buying merchant is present
- **THEN** the surplus is consumed and the Keep's Fabricate currency increases per the configured price

#### Scenario: Crafting costs draw from the same pool
- **WHEN** a recipe with a currency cost is crafted on the Keep
- **THEN** it debits the same Fabricate currency that sales credit

### Requirement: Output economy couples to Keep evolution
A Keep's tier/size SHALL determine storage capacity, baseline consumption, and
merchant attraction, and accumulated surplus and built capacity SHALL contribute to
tier growth.

#### Scenario: Higher tier raises capacity and attraction
- **WHEN** a Keep advances a tier
- **THEN** its storage capacity, consumption, and merchant attraction update for the new tier

### Requirement: Reuse existing machinery and stay system-agnostic
The output economy SHALL reuse the existing stockpile, port buffers, rules engine,
and currency facilities rather than introducing parallel ones, and the set of
managed resources/commodities SHALL be data-driven so any game system can define its own.

#### Scenario: Buffers hold buffered overflow
- **WHEN** overflow is `buffered`
- **THEN** it uses the existing Keep port-buffer structure, not a new store

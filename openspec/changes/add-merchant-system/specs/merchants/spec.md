# merchants

## ADDED Requirements

### Requirement: A merchant is a typed record bound to a Keep
The system SHALL model a merchant as a record bound to a Keep, carrying a
content-defined `type`, a `capacity`, current `stock` (item + quantity + price), a
`restock` rule, and a `buys` list. Merchant state SHALL be stored under the Keep
flag (the membership store pattern), system-agnostic and JSON-authorable.

#### Scenario: A merchant is attached to a Keep
- **WHEN** a merchant is created on a Keep with a type and capacity
- **THEN** it is recorded on the Keep with empty/initial stock and its restock + buy rules

### Requirement: Merchants restock by weighted random selection on a cadence
A merchant SHALL regenerate its stock on a Keep-driven cadence by drawing up to its
capacity from a candidate list, weighted **inversely to item value** by default (with
a tier/capacity rarity bias toward higher-value items). Restock SHALL be performed by
a single authoritative writer and be seedable so a multiplayer world restocks identically.

#### Scenario: A restock fills the shop weighted to cheap goods
- **WHEN** a merchant's restock cadence elapses
- **THEN** its stock is refilled up to capacity, cheaper items appearing more often than rare ones

#### Scenario: A larger Keep stocks rarer goods
- **WHEN** the Keep's tier/merchant capacity is higher
- **THEN** the rarity bias shifts the draw toward higher-value items

### Requirement: Merchants buy surplus for currency (the output sink)
A merchant SHALL buy the resources named in its `buys` list at the configured price,
consuming them from the Keep stockpile and crediting the Keep's currency. Currency
SHALL be the Fabricate currency profile (`actorProperty`) that crafting costs also use.

#### Scenario: Selling surplus credits the Keep currency
- **WHEN** surplus of a bought resource is routed to a merchant that buys it
- **THEN** the surplus is removed from the stockpile and the Keep's Fabricate currency increases by the price

### Requirement: Players buy from stock, with member discounts
A player SHALL be able to buy an item from a merchant's stock, debiting currency,
decrementing stock, and granting the item. A Keep member with a discount benefit
SHALL receive the corresponding price reduction via the benefits subsystem.

#### Scenario: A member buys at a discount
- **WHEN** a Keep member with a discount benefit buys from the merchant
- **THEN** the price is reduced by that benefit's modifier before currency is debited

### Requirement: Attraction and capacity scale with Keep tier
Merchant attraction SHALL scale with the Keep's tier/metrics: tier determines the
number of merchants a Keep supports, their capacity, rarity bias, and restock cadence.
Merchants SHALL only read tier (supplied by the evolution subsystem), not compute it.

#### Scenario: A higher tier attracts more/better merchants
- **WHEN** a Keep is at a higher tier
- **THEN** it supports more merchants with greater capacity and faster restock

### Requirement: Optional Item Piles shop surface, graceful without it
The system SHALL surface a merchant's stock through an Item Piles shop when Item Piles
is active, and SHALL still function with a built-in list when it is absent, never
hard-depending on Item Piles.

#### Scenario: Item Piles absent
- **WHEN** Item Piles is not installed
- **THEN** merchants still restock, buy, and sell through a built-in surface without error

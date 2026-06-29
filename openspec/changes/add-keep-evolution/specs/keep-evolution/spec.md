# keep-evolution

## ADDED Requirements

### Requirement: Tier is computed from metrics via a threshold table
The system SHALL compute a Keep's tier as a pure function of its metrics against a
data-driven threshold table — the highest tier whose every minimum the metrics meet.
Tier SHALL be derived, not hand-set, and stored on the Keep's `tier` field.

#### Scenario: Metrics resolve to a tier
- **WHEN** a Keep's metrics meet a tier's minimums but not the next tier's
- **THEN** its computed tier is that tier and is written to the Keep

#### Scenario: Thresholds are overridable
- **WHEN** a world supplies its own tier threshold table
- **THEN** tier computation uses that table instead of the defaults

### Requirement: Metrics are data-driven and extensible
Keep metrics SHALL be a data map (e.g. membership size, land area, lawfulness/order),
with derived metrics (membership = roster count) computed and others GM/content-set.
The metric set SHALL be extensible by content without engine changes.

#### Scenario: Membership counts as a metric
- **WHEN** members are added to or removed from a Keep
- **THEN** the membership metric reflects the new roster count for tier computation

### Requirement: Tier recomputes on metric change
The system SHALL recompute tier when a metric changes, on the authoritative GM, and
SHALL emit a tier-changed event when the tier moves. Recompute SHALL be event-driven
and SHALL NOT participate in or block the economy tick / clock fast-forward.

#### Scenario: A metric change moves the tier
- **WHEN** a metric change pushes a Keep past a tier threshold
- **THEN** its tier updates and a tier-changed event fires

### Requirement: Tier drives storage capacity, consumption, and merchant attraction
The system SHALL map tier to the values the economy consumes — per-resource storage
capacity, baseline consumption, and merchant attraction (count/capacity/rarity/cadence)
— via data-driven per-tier tables, and SHALL push the storage capacities to the output
pipeline when the tier changes.

#### Scenario: A higher tier raises storage caps
- **WHEN** a Keep advances a tier
- **THEN** its per-resource storage capacities update to the new tier's values

#### Scenario: Tier feeds merchant attraction
- **WHEN** a Keep's tier changes
- **THEN** the merchant count/capacity/rarity/cadence the merchant system reads reflect the new tier

### Requirement: Benefits may gate on tier
A benefit definition SHALL be able to require a minimum tier, becoming available only
when the Keep meets it.

#### Scenario: A tier-gated benefit unlocks
- **WHEN** a Keep reaches the tier a benefit requires
- **THEN** that benefit becomes available to eligible members

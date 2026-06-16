# keep-benefits

## ADDED Requirements

### Requirement: Keep membership roster
A Keep SHALL maintain a roster of members, where each member is a reference to an
existing PC or NPC Actor together with a role. Adding or removing a member SHALL
NOT create or delete the referenced Actor.

#### Scenario: Add an existing actor as a member
- **WHEN** the GM adds an existing Actor to a Keep with a role via `api.keeps.members.add`
- **THEN** the Keep's roster includes a reference to that Actor with the given role
- **AND** no new Actor document is created

#### Scenario: Remove a member
- **WHEN** the GM removes a member from a Keep
- **THEN** the reference is removed from the roster
- **AND** the referenced Actor continues to exist

### Requirement: Benefit definitions with four expression primitives
The engine SHALL accept benefit definitions registered by content, where each
definition declares exactly one expression primitive from {`effect`, `modifier`,
`capability`, `action`}, an eligibility (role and/or minimum tier), and a
condition (`always` or `while-present`). The engine SHALL NOT embed any
game-system-specific semantics in a benefit.

#### Scenario: Register a benefit definition
- **WHEN** content calls `api.benefits.register` with a valid definition on `automate-fvtt.ready`
- **THEN** the definition is available to bind to Keeps
- **AND** a definition declaring an unknown primitive is rejected

#### Scenario: Effect primitive passes content-authored data through
- **WHEN** an `effect` benefit becomes live for a member
- **THEN** the engine applies the content-supplied Active Effect payload to the member's actor unaltered

### Requirement: Benefit resolution is event-driven and re-evaluated on relevant changes
The engine SHALL determine which benefits are live for which member by evaluating
role, tier, and condition gates, and SHALL re-evaluate on membership change, token
scene change, and tier change. The engine SHALL apply or revoke each benefit's
expression idempotently.

#### Scenario: While-present condition toggles on scene change
- **WHEN** a member's token enters the Keep's scene
- **THEN** benefits with the `while-present` condition for that member become live
- **AND** when the token leaves the scene those benefits are revoked

#### Scenario: Tier gate
- **WHEN** a Keep's tier rises to or above a benefit's minimum tier
- **THEN** eligible members gain that benefit on the next resolution
- **AND** if the tier later falls below the minimum the benefit is revoked

### Requirement: Per-benefit resolution mode defaults to interactive
Each benefit SHALL have a resolution mode of `interactive` or `auto`, defaulting
to `interactive`. An `interactive` benefit SHALL surface a GM prompt rather than
apply silently. An `auto` benefit SHALL apply without prompting.

#### Scenario: Default is interactive
- **WHEN** a benefit definition omits a resolution mode
- **THEN** it resolves as `interactive`

#### Scenario: Interactive benefits never block a clock fast-forward
- **WHEN** the GM fast-forwards the clock across a span
- **THEN** interactive benefits do not halt the jump
- **AND** benefits re-resolve once against the state at the landing point

### Requirement: Modifier and capability query surface
The engine SHALL expose live modifier values and capabilities for a member via the
public API so that adapters and content can honor them. Where the engine owns the
underlying resource (e.g. the stockpile), it SHALL enforce the capability.

#### Scenario: Query a member modifier
- **WHEN** content calls `api.keeps.getMemberModifier(member, key)`
- **THEN** the engine returns the value resolved from all live contributions to that key

#### Scenario: Same-key modifiers combine highest-wins by default
- **WHEN** multiple live benefits contribute to the same modifier key with no override strategy
- **THEN** the engine resolves to the single most favorable contribution rather than summing them
- **AND** content may override the combine strategy per key (e.g. additive)

#### Scenario: Stockpile-access capability is enforced
- **WHEN** a member without a stockpile-withdrawal capability attempts a withdrawal through the API
- **THEN** the engine denies the withdrawal

### Requirement: Action benefits are invokable and emit events
An `action` benefit SHALL be exposed as available to eligible members and, when
invoked, SHALL emit an event for content to execute; the engine SHALL NOT perform
the system-specific effect itself.

#### Scenario: Invoke an action benefit
- **WHEN** an eligible member invokes an `action` benefit
- **THEN** the engine emits a `keep.benefitInvoked` event with the benefit and member
- **AND** the engine does not itself apply any system-specific effect

### Requirement: Generic cookbook and importer seam
The engine SHALL ship a small generic, system-agnostic set of example benefits as
a reference/fallback, and SHALL provide an importer seam to convert
license-permissive external content into benefit definitions for GM review.

#### Scenario: Generic cookbook available as fallback
- **WHEN** no content module registers benefits
- **THEN** the generic starter benefits are still available to bind

#### Scenario: Import external content into benefit definitions
- **WHEN** an importer is run against license-permissive source data
- **THEN** it produces benefit definitions for the GM to review before they are committed

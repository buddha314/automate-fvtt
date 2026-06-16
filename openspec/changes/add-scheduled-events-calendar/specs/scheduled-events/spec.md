# scheduled-events

## ADDED Requirements

### Requirement: World-time event queue
The engine SHALL maintain a queue of scheduled events ordered by fire time, where
each event declares a fire time, a kind, a payload, a resolution mode
(`auto | interactive`), and a visibility (`gm | players`). Events MAY be one-time or
simple recurring.

#### Scenario: Schedule a one-time event
- **WHEN** the GM schedules an event at a future world-time
- **THEN** the event appears in the queue ordered by its fire time
- **AND** it is not applied until world-time reaches its fire time

#### Scenario: Recurring event expands into occurrences
- **WHEN** the GM schedules a simple recurring event
- **THEN** the engine processes each occurrence individually as its fire time is reached

### Requirement: Replay on clock advance
When the clock advances across a span, the engine SHALL process every event
occurrence whose fire time falls in the span, in chronological order. `auto`
occurrences SHALL apply without prompting; an `interactive` occurrence SHALL halt
the advance at its fire time and resume only after the GM resolves it.

#### Scenario: Deterministic events integrate across a fast-forward
- **WHEN** the GM fast-forwards a week and a `depositResources` event lies within the span
- **THEN** the engine applies the deposit to the stockpile as part of the jump
- **AND** the jump completes to the target time

#### Scenario: Interactive event halts the jump
- **WHEN** the GM fast-forwards across a span containing a `promptGM` event
- **THEN** the advance halts at that event's fire time and surfaces the prompt
- **AND** after the GM resolves it, the advance continues from that fire time

### Requirement: Idempotent processing
The engine SHALL process each event occurrence at most once. Re-running or
overlapping a previously processed span SHALL NOT apply any occurrence again.

#### Scenario: Re-advancing an already-processed span does nothing
- **WHEN** a span is advanced and then advanced again over the same range
- **THEN** no occurrence in that range is applied a second time

### Requirement: Event kinds delegate to existing subsystems
The engine SHALL support event kinds `depositResources`, `grantBenefit`,
`revokeBenefit`, `promptGM`, and `toggleRule`, each delegating to an existing
subsystem (stockpile, Change A benefits, GM prompt, rules engine). A `grantBenefit`
event with a window SHALL auto-schedule its paired `revokeBenefit` at the window
end.

#### Scenario: Toggle a rule via a scheduled event
- **WHEN** a `toggleRule` event with `enabled: false` fires for a producer rule
- **THEN** the engine disables that rule (the supply disruption)

#### Scenario: Benefit granted on a window is revoked at window end
- **WHEN** a `grantBenefit` event with a window fires
- **THEN** the benefit is granted
- **AND** a paired revoke is processed at the window's end time

### Requirement: GM-only event visibility
The engine SHALL hide `gm`-visibility events from players until the GM reveals
them, while still applying their effects when they fire. `players`-visibility events
SHALL be shown to players.

#### Scenario: Players feel a hidden event without seeing it
- **WHEN** a `gm`-visibility `toggleRule` event disrupts a supply
- **THEN** players observe the resulting shortfall
- **AND** the event itself is not shown to players on the calendar

### Requirement: Calendar module is an optional, swappable UI skin
The engine SHALL own event correctness independently of any calendar module. A
calendar module integration SHALL be optional, accessed only through the module's
public API behind a swappable adapter, and SHALL degrade gracefully when absent by
falling back to a built-in event list. No calendar module SHALL be required for
correctness.

#### Scenario: No calendar module installed
- **WHEN** no supported calendar module is active
- **THEN** scheduled events still fire correctly on clock advance
- **AND** the GM can manage events through a minimal built-in list

#### Scenario: Calendar module present and enabled
- **WHEN** a supported calendar module is active and the integration toggle is on
- **THEN** events are rendered and editable through the module, mapping visibility onto its native levels

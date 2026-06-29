# crafting-tutorial

## ADDED Requirements

### Requirement: Opt-in, self-contained, removable tutorial
The tutorial SHALL be launched explicitly (macro/setting), SHALL create its own
sample Keep and tutorial tree without touching a campaign's real data, and SHALL
provide a teardown that removes what it created.

#### Scenario: Launch and teardown leave the world clean
- **WHEN** the GM launches the tutorial and later runs its teardown
- **THEN** a sample Keep + tutorial tree are created during the tutorial
- **AND** after teardown the world is restored with no tutorial artifacts left

### Requirement: Teaches the full crafting loop with real APIs
The tutorial SHALL walk the user through the actual loop — obtaining raw materials,
running a conversion recipe, seeing the stockpile update, and advancing time to see a
tick-bound craft — using the module's real `api.*` surfaces so the knowledge transfers.

#### Scenario: A user completes a first craft
- **WHEN** the user follows the tutorial steps
- **THEN** they obtain a material, run a recipe, and see the resulting item projected into the Keep stockpile

### Requirement: Original, license-clean tutorial content
The tutorial content SHALL be original/generic and SHALL NOT reuse third-party
Reserved Material, so it carries no licensing obligations.

#### Scenario: Tutorial ships without third-party notices
- **WHEN** the tutorial is shipped
- **THEN** its tree and content are original and require no third-party license notice

### Requirement: In-context help entry point
The module SHALL surface an entry point to the tutorial / "how crafting works" from
the Keep panel and link to the docs.

#### Scenario: Help is reachable from the Keep panel
- **WHEN** a GM opens the Keep panel
- **THEN** a discoverable entry point to the tutorial/help is available

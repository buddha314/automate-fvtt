# orc-example-crafting-trees

## ADDED Requirements

### Requirement: Reuse only ORC Licensed Material
Each example crafting tree SHALL reuse only Pathfinder 2e (Remaster) or Starfinder 2e
content that is **Licensed Material** under Paizo's ORC License (crafting rules and
mechanical stat lines). It SHALL NOT reuse **Reserved Material** — the
"Pathfinder"/"Starfinder" trademarks and logos, setting lore/flavor text,
distinctive (Product Identity) names, story content, art, or maps — and SHALL NOT
imply Paizo endorsement.

#### Scenario: Mechanical stats are shipped, lore is not
- **WHEN** a PF2e or SF2e item is authored into an example tree as a Fabricate component
- **THEN** its mechanical attributes (the Licensed Material) are used
- **AND** its setting lore/flavor description and any Product-Identity name are excluded

#### Scenario: The module is not branded with a trademark
- **WHEN** a tree ships or surfaces PF2e/SF2e-derived content
- **THEN** it does not use the "Pathfinder"/"Starfinder" names/logos to brand the module or imply endorsement

### Requirement: Ship the ORC NOTICE with each tree
Because the trees redistribute ORC Licensed Material, the module SHALL include a
conformant ORC NOTICE (Attribution Notice, Reserved Material Notice, and the
upstream ORC Notice block crediting the Paizo source book(s)) in a shipped notice
file and surface it in-app for each shipped tree.

#### Scenario: A shipped tree carries its ORC notice
- **WHEN** an example tree containing ORC-derived Licensed Material is shipped
- **THEN** a conformant ORC NOTICE accompanies it and is discoverable in-app

### Requirement: System-agnostic, compliant content source
Each tree SHALL be independently authored ORC-derived content shipped as a
self-contained Fabricate seed whose components reference the module's own shipped
item identifiers — usable regardless of the world's game system. The module SHALL
NOT scrape Archives of Nethys and SHALL NOT redistribute the `pf2e`/`sf2e` game
system compendia.

#### Scenario: A tree loads in any world
- **WHEN** an enabled tree is seeded in a PF2e world, an SF2e world, or another system's world
- **THEN** it seeds successfully without depending on that world's game system content

#### Scenario: Prohibited sources are never used
- **WHEN** a tree is built or seeded
- **THEN** it never fetches/bulk-copies Archives of Nethys content
- **AND** it never bundles or copies the `pf2e`/`sf2e` system compendium packs

### Requirement: Multiple optional trees, opt-in per tree
The module SHALL offer multiple independent example trees (at minimum a PF2e tree
and an SF2e tree), each enabled or disabled independently and **disabled by
default**. An enabled tree SHALL be seeded idempotently; a disabled tree SHALL NOT
be seeded. Example trees SHALL remain distinct from a campaign's real Keep economy.

#### Scenario: Trees are off by default
- **WHEN** the module loads with default settings
- **THEN** no example tree is seeded until the GM enables one

#### Scenario: Enabling one tree does not load the other
- **WHEN** the GM enables only the PF2e tree
- **THEN** the PF2e tree is seeded
- **AND** the SF2e tree is not seeded

### Requirement: Pluggable tree-source import mechanism
Trees SHALL be loaded through a single pluggable source interface with a declared
**provenance**: `shipped` (curated ORC-derived content the module bundles),
`fabricate-library` (an existing Fabricate crafting-system export), `installed-system`
(the active game system's compendia), `module` (a separately installed/purchased
content module or source rule package), or `user-export` (a file the user supplies).
The `shipped` provider is required; the other providers MAY be deferred but the
interface SHALL accommodate them without rework.

The module MAY redistribute `shipped` content (ORC-derived, with the NOTICE) and MAY
redistribute `fabricate-library` content only where that entry's upstream license
permits. Every owned-content provider (`installed-system`, `module`, `user-export`)
SHALL transform the user's already-licensed content locally and SHALL NOT re-export,
bundle, or publish it.

#### Scenario: Build on an existing Fabricate library tree
- **WHEN** an existing Fabricate crafting-system export is selected as a `fabricate-library` source
- **THEN** it is seeded through the existing pipeline, honoring its upstream license

### Requirement: Contribute content back only when licensed to share
When the module exports a tree to contribute back to the Fabricate library, it SHALL
export only content the project is licensed to redistribute — its own `shipped`
ORC-derived trees (with the ORC NOTICE preserved in the export) or original work. It
SHALL NOT export content produced by an owned-content provider (`installed-system`,
`module`, `user-export`) or any Reserved Material.

#### Scenario: Contributed export preserves attribution
- **WHEN** a `shipped` ORC-derived tree is exported for contribution
- **THEN** the export carries its ORC NOTICE forward

#### Scenario: Owned-content output is not contributable
- **WHEN** a tree produced by an owned-content provider is offered for contribution
- **THEN** the module refuses to export it for redistribution

#### Scenario: Full breadth comes from content the user owns
- **WHEN** a user wants the full crafting tree beyond the shipped examples
- **THEN** an owned-content provider maps their installed/purchased content into Fabricate locally
- **AND** the module does not redistribute that content

#### Scenario: Provenance guard blocks redistribution of owned content
- **WHEN** a non-`shipped` provider produces a tree
- **THEN** the module does not re-export, bundle, or publish that produced content

### Requirement: Map tree content into the Fabricate economy
A tree's items/materials SHALL become Fabricate components and its crafting
relationships SHALL become Fabricate recipes, seeded through the existing
seed/import pipeline and wired through the component→resource map so owned/crafted
items project into the Keep stockpile.

#### Scenario: A tree material projects into the stockpile
- **WHEN** an enabled tree's material is a mapped component and a Keep owns matching items
- **THEN** the existing inventory matcher folds them into the Keep stockpile by component id

# example-module-boilerplate

## ADDED Requirements

### Requirement: Copyable skeleton module under examples/
The boilerplate SHALL ship in-repo under `examples/` as a copyable skeleton an author
clones and renames, containing a `module.json` template, an entry script, sample
content, an onboarding skeleton, a tests skeleton, and licensing templates. It SHALL
NOT be packaged or released as a real, dependable module.

#### Scenario: An author starts from the skeleton
- **WHEN** an author copies the boilerplate and renames it
- **THEN** they have a working, license-clean starting point that loads against the engine

### Requirement: Graduate to a generated GitHub template repository (deferred)
When the skeleton stabilizes, the project SHALL graduate it to a standalone GitHub
**template repository** ("Use this template") generated from the in-repo `examples/`
copy, so `examples/` remains the single source of truth and the two do not drift.

#### Scenario: Template repo is generated from examples/
- **WHEN** the template repository is produced
- **THEN** it is generated from the in-repo `examples/` boilerplate rather than hand-maintained separately

### Requirement: Follows the dependency contract
The boilerplate SHALL declare `automate-fvtt` and `fabricate` in `module.json`
relationships, do its work on the `automate-fvtt.ready` hook guarded to the primary
GM, and interact only through `game.modules.get("automate-fvtt").api`, degrading
gracefully when an optional dependency is absent.

#### Scenario: Boilerplate uses only the public API
- **WHEN** the boilerplate runs
- **THEN** it reaches the engine only via the public `api` surface and does not touch internals

#### Scenario: Optional dependency absent
- **WHEN** an optional (soft) dependency is not installed
- **THEN** the boilerplate still loads and degrades without error

### Requirement: Demonstrates each content type
The boilerplate SHALL include runnable samples for the core content types: seeding a
crafting tree (with `setComponentMap`), creating a Keep, registering an economy rule,
defining a benefit, and a scene/resource-node + gathering link stub.

#### Scenario: Sample content seeds on load
- **WHEN** the boilerplate's ready hook runs as primary GM
- **THEN** its sample crafting tree seeds idempotently and a sample Keep + rule are created

### Requirement: Ships per-license NOTICE templates and a checklist
The boilerplate SHALL include NOTICE templates for CC-BY, ORC, and OGL (Section 15
stub) and a licensing-checklist file, with one license per shipped tree and no
cross-regime commingling.

#### Scenario: Author has notices ready to fill in
- **WHEN** an author ships a tree derived from licensed content
- **THEN** the matching NOTICE template is present to complete and the checklist guides exclusion of Reserved Material

### Requirement: Kept in lockstep with the playbook
The boilerplate SHALL stay consistent with `MODULE-PLAYBOOK.md`; the two SHALL
cross-reference each other and change together.

#### Scenario: Playbook and skeleton agree
- **WHEN** the playbook describes a convention
- **THEN** the boilerplate demonstrates that same convention

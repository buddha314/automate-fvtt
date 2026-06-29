# example-tree-candidates

## ADDED Requirements

### Requirement: Maintain a crafting-tree candidate catalog
The research SHALL maintain a catalog of candidate crafting-tree sources, where each
entry records its license, source/provenance, breadth-and-fit for the Keep economy,
effort estimate, and status.

#### Scenario: A candidate is catalogued
- **WHEN** a new crafting-tree source is identified
- **THEN** it is added to the catalog with its license, provenance, fit, effort, and status

### Requirement: License-first evaluation with tiered acceptance
The research SHALL evaluate license reusability before other criteria. Candidates
under **CC-BY, ORC, MIT/permissive, public-domain, or the project's own original
work** SHALL be treated as **first-class**. Candidates under **OGL 1.0a / OGC** SHALL
be **allowed but lower-priority and opt-in**, included only when their crafting depth
justifies the Section 15 upkeep and the loss of upstream contributability. Proprietary
or Reserved-Material-only sources SHALL be rejected, and trademarks, lore,
Product-Identity names, and art SHALL be excluded regardless of the mechanics' license.

#### Scenario: A first-class candidate advances
- **WHEN** a candidate's crafting mechanics are under CC-BY, ORC, a permissive license, public domain, or are original
- **THEN** it advances to fit/effort evaluation as a first-class candidate

#### Scenario: An OGL candidate is allowed but flagged
- **WHEN** a candidate's content is OGL/OGC only
- **THEN** it is catalogued as allowed-but-opt-in and flagged for the Section 15 + non-contributable trade-offs

#### Scenario: A proprietary candidate is rejected
- **WHEN** a candidate's content is proprietary or only Reserved Material
- **THEN** it is recorded as rejected and not shortlisted

### Requirement: Per-tree license isolation and notice
Each shortlisted tree SHALL carry its own license and the notice that license
requires (the CC-BY attribution string, the ORC NOTICE, or the OGL text + Section 15),
and SHALL NOT commingle content across license regimes. An OGL tree SHALL be gated by
its own toggle so the rest of the module never inherits OGL obligations.

#### Scenario: Each tree ships its own notice
- **WHEN** a tree derived from licensed material is shipped
- **THEN** it carries that license's required notice and does not mix in content from another license regime

#### Scenario: OGL obligations stay scoped to the OGL tree
- **WHEN** an OGL tree is present alongside CC-BY/ORC/original trees
- **THEN** the OGL obligations apply only to that tree, behind its own toggle

### Requirement: Produce a ranked shortlist mapped to provenance
The research SHALL produce a ranked shortlist of recommended example trees, each
annotated with a recommended `TreeSource` provenance and its license posture
(including any required attribution/notice).

#### Scenario: Shortlist entries are actionable
- **WHEN** the research concludes a round
- **THEN** each shortlisted pick names its provenance and license/attribution requirements

### Requirement: Keep the catalog current
The research SHALL re-evaluate a catalog entry when it is selected for
implementation or when its license or source materially changes.

#### Scenario: A license change triggers re-evaluation
- **WHEN** a catalogued candidate's license or source changes
- **THEN** its catalog entry is re-evaluated

### Requirement: Hand off without authoring trees here
This research SHALL feed shortlisted picks into the examples program (#38) and SHALL
NOT author or import any crafting tree itself.

#### Scenario: A pick is handed to the examples program
- **WHEN** a candidate is shortlisted and selected
- **THEN** it becomes an implementation item under the examples program, not this change

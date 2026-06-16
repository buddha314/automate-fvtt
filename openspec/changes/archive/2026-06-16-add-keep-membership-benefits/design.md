# Design — Keep Membership & Benefits

## Context

`automate-fvtt` is the system-agnostic **engine**; rules, items, and content come
from content modules (`engine-vs-content-split`). The existing rules engine is
**tick-driven** deterministic economy math (producer/converter/upkeep), with a
planned `auto | interactive` resolution mode and a `running | paused` clock
(`rule-resolution-modes`). Benefits must fit that philosophy: the engine provides
mechanism, content provides meaning, and a human GM is always present as the
backstop.

## Relationship to Fabricate (design note)

We work **in conjunction with the Fabricate library**, not in competition. Fabricate
is in rapid development and maintains its own OpenSpec specs at
`../fabricate/openspec/specs` (overview, integrations, gathering-and-harvesting,
data-models, resolution-modes, …) — **monitor it; do not duplicate its effort**.
Consequences for this change:

- **Read, don't rebuild.** The `capability` primitive "access to gathered
  resources" should surface Fabricate's gathering/harvesting output (it already
  ships gathering), not reimplement it. Consume via its public API behind our
  `fabricate-adapter.js` seam.
- **Mirror their integration contract.** Their integrations spec requires: a
  feature toggle, detect-installed-and-active, exchange data only via public API,
  graceful absence (no errors when absent), a documented version range, and tests
  that mock the companion API. Our Fabricate touchpoints SHALL follow the same
  contract.
- **Terminology collision — disambiguate.** Fabricate's "resolution modes" are
  `simple | routed | progressive | alchemy` (how a craft selects results). *Our*
  resolution modes are `auto | interactive` (Decision 3 — how a benefit/tick rule
  resolves). Same words, different axis; never conflate them in docs or code.

## Goals

- A benefit abstraction general enough for any game system, easy enough to use
  out of the box (familiar examples), and customizable (define your own).
- Keep the engine ignorant of system specifics (no "long rest" knowledge).
- Lean on the GM rather than over-automate: prompt-and-apply, don't enforce.

## Non-goals

- Tier computation, clock controls, scheduled events (separate changes).

## Decision 1 — A benefit has four expression primitives

Sorting issue #25's own examples by *how they must manifest in Foundry* yields four
distinct shapes. Active Effects alone cover only one of them.

```
            ┌──────────────────────┐
            │   Benefit (abstract) │   ← content defines
            └──────────┬───────────┘
                       │ engine resolves to one of:
     ┌──────────┬──────┴───────┬──────────────────┐
     ▼          ▼              ▼                  ▼
 ┌────────┐ ┌──────────┐  ┌───────────┐   ┌──────────────┐
 │ EFFECT │ │ MODIFIER │  │CAPABILITY │   │   ACTION     │
 │native  │ │named     │  │permission/│   │invokable +   │
 │AE on   │ │scalar,   │  │quota the  │   │engine emits  │
 │member  │ │queried   │  │engine     │   │event; content│
 │actor   │ │via API   │  │owns/exposes│  │executes      │
 └────────┘ └──────────┘  └───────────┘   └──────────────┘
 advantage,  price mult,   stockpile draw, summon guard,
 AC, speed   rest-time     storage, votes  call to arms
```

- **Effect** — a native Foundry Active Effect payload (supplied by content) that
  the engine grants/revokes on the member's actor. The game system interprets it.
- **Modifier** — a named scalar the engine stores and exposes via query API
  (e.g. `merchant.priceMultiplier`, `rest.timeMultiplier`). Nothing native reads
  it; our adapters (Item Piles) or content do. Engine owns stacking/tier scaling.
- **Capability** — a boolean/quota permission. Where the engine owns the resource
  (stockpile withdrawal, storage slots, voting weight) it can enforce; otherwise
  it exposes the capability for content to honor.
- **Action** — an invokable benefit. Engine marks it available and emits an event;
  content executes the effect (and the GM adjudicates).

The four survive a survey of real stronghold systems (5e Bastions, PF2e Kingmaker
structures, PF1e Ultimate Campaign, Blades claims, MYZ Ark projects, AD&D
followers) — no fifth primitive was needed.

### Boundary cases (named, not new types)
- **Economy generation** ("income"/"resource" benefits) is *already* the tick
  producer rules — model as a benefit that binds a rule, not a fifth primitive.
- **Followers / garrison / cohort** is a Capability whose value is an NPC roster
  (overlaps existing `counts.henchmen` and the Members roster).

## Decision 2 — The resolver is an event-driven sibling of the tick engine

The engine's real work is not the expression — it's deciding, at any moment, which
benefits are live for which member:

```
for each member M of Keep K:
  for each benefit B bound to K:
     eligible? ── role gate    (is M's role allowed?)
               ── tier gate    (K.tier >= B.minTier?)        ← reads tier, see deps
               ── condition    (always | while-present-on-keep-scene)
     eligible & condition-met → ensure expression applied
     else                      → ensure expression revoked
```

Re-resolution fires on **events** — membership change, token scene change (the
"while in the Keep" condition; the engine knows the Keep's `sceneId`), and tier
change — **not** on the economy tick. Benefits and tick rules are *siblings*: same
"content registers, engine resolves" pattern, different trigger model.

**Compose-with-clock property:** because benefits don't participate in the tick,
they snapshot at the *landing point* after a fast-forward and **never block a
jump**. Only interactive *tick rules* halt a fast-forward. Benefits re-resolve
once against the new state.

## Decision 3 — Resolution mode: default `interactive`, opt into `auto`

Reuse the `auto | interactive` axis from `rule-resolution-modes`. Because a GM is
always present, the safe default is **`interactive`** — the engine surfaces the
benefit (chat card / prompt) and the GM applies it — with deterministic benefits
opting into **`auto`** to apply silently. This lets us under-automate on purpose.

## Decision 4 — Cookbook = generic examples shipped + importer seams

"Easy + familiar" = ship examples modeled on the games people know. "Flexible" =
the four primitives + custom definitions. Split per `engine-vs-content-split`:

```
ENGINE ships  ── a tiny GENERIC cookbook (system-agnostic: rest, storage, voting)
                 as reference/fallback, like FABRICATE.SEED_SYSTEMS
CONTENT ships ── system cookbooks (bandits / automate-fvtt-pathfinder)
IMPORTERS     ── auto-port from license-permissive sources (OGL PF2e Kingmaker
                 structures → EFFECT/MODIFIER benefits); GM reviews before commit.
                 Same ingestion seam as issue #20 (reuse OGL data, re-author code).
```

## Decision 5 — Members reference existing Actors

A member is a reference (UUID/id) to an existing PC/NPC Actor plus a `role`, not a
new document. Foundry has no native membership relation, so the Keep owns the
roster. Roles gate benefit eligibility and back voting weight.

## Decision 6 — Roles are a content-defined vocabulary

The engine treats `role` as an **opaque string**; it never hard-codes a role
enum. Content modules declare the role vocabulary for their system, and benefit
eligibility gates on those strings. The engine + generic cookbook ship **example
role sets drawn from multiple systems** as reference/fallback so the feature feels
familiar out of the box:

```
SYSTEM            EXAMPLE ROLE VOCABULARY (illustrative)
────────────────  ─────────────────────────────────────────────────
Pathfinder        Kingmaker/Leadership roles — Ruler, Counselor,
                  General, Marshal, Treasurer, Warden, … + cohort/followers
D&D               stronghold/Bastion — owner/lord, retainers, artisans,
                  hirelings, defenders
Mutant Year Zero  the Ark's People — the Boss, project leads, residents
Forbidden Lands   stronghold — owner, hirelings (by function), defenders
```

Per-role config (e.g. voting weight, default eligibility) is content-supplied
alongside the vocabulary; the engine just resolves it.

## Decision 7 — Modifier stacking defaults to highest-wins

When multiple live benefits (across benefits and tiers) contribute to the same
named modifier key, the engine SHALL resolve to the **single most favorable
value** — highest-wins, akin to D&D's same-type-bonuses-don't-stack rule — rather
than summing. This is the default; content may override the combine strategy per
modifier key (e.g. additive) where a system needs it.

## Decision 8 — Benefits live in a side module, not on the KeepModel

Benefit definitions, bindings, and resolved state live in a **side
module/registry keyed by keep id**, not as fields on `KeepModel`. Only membership
(the roster) goes on the actor. Rationale: flexibility — content registers/updates
benefit definitions and bindings independently of the Keep actor's persistence,
the registry can be rebuilt from content on `automate-fvtt.ready`, and the actor
schema stays lean. The KeepModel may hold lightweight references (e.g. bound
benefit ids) but the authoritative binding/state store is the side module.

## Data model

- **On `KeepModel`:** `members[]` — `{ actorUuid, role, joinedAt? }`. The actor
  may also hold lightweight bound-benefit-id references.
- **In the side module (Decision 8):** benefit *definitions* (populated by content
  on `automate-fvtt.ready`), *bindings* per keep id (+ per-binding overrides such
  as `minTier`, allowed roles), and resolved *state*.

## Open questions

All exploration open questions are resolved — see Decisions 6 (roles), 7
(modifier stacking), and 8 (side module).

## Risks

- Active Effect application differs per system — the Effect primitive must pass
  content-authored AE data through untouched and let the system interpret it.
- Over-automation creep — keep `interactive` the default; resist auto-enforcing
  things the GM should adjudicate.

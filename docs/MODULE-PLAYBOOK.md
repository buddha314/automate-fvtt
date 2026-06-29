# Module Playbook — building content on Automate FVTT

How to build a Foundry content module on top of the Automate FVTT Keep economy +
Fabricate. Covers the module types, the dependency contract, shipping each kind of
content, onboarding, packaging, testing, and licensing. See
[STARTER-MODULES.md](STARTER-MODULES.md) for the bundle these compose into.

## 1. Module types

Pick the smallest type that fits; a full starter is several of these together.

- **Adventure / world pack** — scenes, NPCs, journals, a pre-built Keep + merchant,
  shipped as an `Adventure` document with an importer.
- **Crafting-tree pack** — one or more Fabricate crafting systems (components +
  recipes) as example trees.
- **Scene / resource-node pack** — scenes with resource nodes placed on tiles, tied
  to gathering environments/tasks.
- **Rules / economy pack** — registered economy rules (harvest/craft/upkeep) + a
  component map, optionally benefits.

## 2. The dependency contract (always)

Declare and integrate the same way the engine treats Fabricate (`dependency-strategy`):

- In `module.json` `relationships.requires`: `automate-fvtt`, `fabricate`
  (+ soft-dep a calendar module if you use scheduled time).
- **Detect active, don't assume**: `game.modules.get("automate-fvtt")?.active`.
- **Public API only**: `const api = game.modules.get("automate-fvtt").api;` — use
  `api.keeps`, `api.rules`, `api.fabricate`, `api.benefits`, `api.time`. Never reach
  into internals.
- **Graceful absence**: no errors if a soft dep is missing; degrade.
- **Version range**: state tested versions; the engine is pre-1.0 and shifts.
- Do work on the `automate-fvtt.ready` hook (after the Fabricate handshake), and let
  the **primary GM** do one-time seeding (idempotent).

## 3. Shipping a crafting tree

1. Build the system once in Fabricate's UI → **Export System** → JSON
   (`{ fabricateVersion, exportedAt, system, recipes }`), drop it in your module.
2. Seed it via `api.fabricate.seedSystem("modules/<you>/data/<tree>.json")` on
   ready (primary GM; idempotent — re-seeds skip).
3. Map components to Keep resources: `api.rules.setComponentMap([{ componentId,
   resourceKey }, …])`.
4. Prefer **simple resolution mode with the check disabled** for deterministic
   conversion; reserve routed/progressive for intentional variability.
5. **Provenance + license** (see §9): tag the tree's source and ship its NOTICE; keep
   one license per tree, never commingled.

For "build on what exists," seed an existing **Fabricate-library** system directly,
or import from content the **user already owns** (their system/compendium) — mapping
locally, never redistributing. (See #38's `TreeSource` model.)

## 4. Shipping scenes + resource nodes

- Ship scenes in a **scene compendium pack**; node *placements* live on the
  Scene/tiles, not in the crafting-system JSON.
- Link a node/scene to a Fabricate **gathering environment + task** so harvesting
  runs; enable `features.gathering` on the system.
- Yield projects into the Keep via the `fabricate.gathering.attemptCompleted` hook
  (covers immediate and matured-timed runs) — no polling.

## 5. Shipping a Keep / economy

- Create a Keep: `api.keeps.create({ name, stockpile, counts })` — it's a **core
  actor type + module flag** (pf2e-safe), not a subtype. Open its panel with
  `api.keeps.open(keep)`.
- Register economy rules: `api.rules.register(api.rules.makeFabricateRule({ … }))`
  for harvest/craft; plain numeric rules for non-Fabricate flows.
- Membership/benefits: `api.keeps.members.add(...)`, define benefits via
  `api.benefits` (event-driven; auto vs interactive).
- Writes happen on the single authoritative GM — don't double-write from clients.

## 6. Onboarding UX

- Ship a **welcome splash** (ApplicationV2) that checks required deps and offers a
  one-click **Adventure importer** — the `bandits-on-the-river` pattern
  (`tests/foundry-splash.spec.js` shows the shape).
- Gate the import button on deps present; show what's missing.

## 7. Packaging & release

- `module.json`: `id`, `compatibility`, `relationships`, `esmodules`/`styles`,
  `manifest`/`download` → `releases/latest/download/{module.json,module.zip}`.
- Publish via a release workflow that attaches `module.json` + `module.zip`.
- **Version consistency**: git tag ⇄ committed manifest version ⇄ in-zip manifest
  version (see the `manifest-install` change #39).
- Installable by pasting the manifest URL; optionally list on the Foundry registry.

## 8. Testing

- **Unit-test the pure logic** with `node --test` (keep transforms pure, like
  `component-map.js`).
- **Drive the real app** with the Playwright harness (join as GM, evaluate world
  state) — gracefully skip when no licensed Foundry/seat (see the `fabricate-*`
  specs). Add a **surface contract test** for any external API you depend on so
  drift fails loudly.
- Reminder: Foundry loads a symlinked module's **built `dist/`** for systems like
  Fabricate — rebuild before live-testing source changes.

## 9. Licensing checklist (do this first, not last)

- Reuse only content you're licensed to: **CC-BY**, **ORC**, **OGL/OGC** (opt-in,
  Section 15), **permissive**, **public-domain**, or **original**. Reject
  proprietary / Reserved-Material-only.
- **Exclude Reserved Material**: trademarks/logos, lore/flavor, Product-Identity
  names, art — regardless of the mechanics' license.
- **Ship the required notice per tree**: CC-BY attribution string / ORC NOTICE / OGL
  text + Section 15 — one license per tree, never commingled.
- **Don't redistribute** the user's owned content or another system's compendium
  packs; transform locally. **Don't scrape** SRD sites.
- For commercial release, get a human/legal review. (Background: #38, #40.)

## 10. API quick reference

`const api = game.modules.get("automate-fvtt").api;`

- `api.keeps` — `create`, `open`, `get`/`list`, `getData`, `setResource`/`adjustResource`,
  `setCount`, `members.{add,remove,setRole,list}`, `collectPorts`.
- `api.rules` — `register`/`unregister`/`list`, `makeFabricateRule`, `setComponentMap`,
  `setDelivery`, `FAB_OP`, `DELIVERY`.
- `api.fabricate` — `seedSystem`, `exportSystem`, `importSystem`, `getSystem`,
  `listSystems`, `readInventory`, `craft`, `startGathering`.
- `api.benefits` — register/list definitions, `approve`, `invoke`, importers.
- `api.time` — `open`/`toggle` controls, `onTick`.
- Hooks: `automate-fvtt.ready`, `.keepUpdated`, `.tick`, `.membershipChanged`,
  `.benefitInvoked`, `.benefitPending`; plus `fabricate.gathering.attemptCompleted`.

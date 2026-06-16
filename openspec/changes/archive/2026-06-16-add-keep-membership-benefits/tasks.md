# Tasks — Keep Membership & Benefits

## 1. Data model
- [x] 1.1 Add `members[]` (`{ actorUuid, role, joinedAt? }`) to `KeepModel`; roles are opaque strings.
- [x] 1.2 Stand up the benefits side module (Decision 8): definitions + bindings-per-keep-id + resolved state, keyed by keep id; rebuildable from content on `automate-fvtt.ready`.
- [x] 1.3 Optionally store lightweight bound-benefit-id references on `KeepModel` (`boundBenefitIds`).

## 2. Benefit registry + definitions
- [x] 2.1 Define the benefit definition shape (id, primitive, eligibility, condition, mode).
- [x] 2.2 Implement `api.benefits.register/unregister/list` populated by content on `automate-fvtt.ready`.
- [x] 2.3 Default `mode = "interactive"`; validate primitive ∈ {effect, modifier, capability, action}.

## 3. Expression primitives
- [x] 3.1 Effect — grant/revoke content-supplied Active Effect on the member actor.
- [x] 3.2 Modifier — store named scalars; expose `api.keeps.getMemberModifier(keepId, actorUuid, key)`.
- [x] 3.3 Capability — boolean/quota; enforce stockpile-withdrawal (`memberWithdraw`) where engine owns it; expose the rest.
- [x] 3.4 Action — mark available + emit `automate-fvtt.benefitInvoked` event for content to execute.

## 4. Resolver
- [x] 4.1 Implement per-member eligibility (role gate, tier gate reading `keep.tier`, condition).
- [x] 4.2 Re-resolve on events: membership change, token scene change ("while present"), tier change.
- [x] 4.3 Apply/revoke expressions idempotently (safe to re-run on the same state).
- [x] 4.4 Verify benefits never block a clock fast-forward; re-resolve at the landing point (`updateWorldTime`).

## 5. Membership API
- [x] 5.1 `api.keeps.members.add/remove/setRole/list` (members reference existing Actors).
- [x] 5.2 Emit membership-change hooks that drive the resolver (`membershipChanged` + `updateActor` listener).

## 6. Cookbook
- [x] 6.1 Ship a generic, system-agnostic starter cookbook (rest, storage, voting, stockpile access, summon-guard) as reference/fallback.
- [x] 6.2 Build the importer seam; reference importer: OGL PF2e Kingmaker structures → modifier benefits (GM reviews before commit).

## 7. UI
- [x] 7.1 Keep sheet: members section (roster + roles).
- [x] 7.2 Keep sheet: benefits view (live per member; invoke Action benefits).
- [x] 7.3 Interactive-benefit GM prompt (whispered chat card / apply button).

## 8. Tests & docs
- [x] 8.1 Resolver unit tests (eligibility gates, condition toggling, idempotency).
- [x] 8.2 Primitive tests — modifier stacking, capability resolution, importer + cookbook covered by `test/benefits.test.js`. (Effect grant/revoke and the action event are Foundry-integration paths in `benefit-engine.js`, exercised in-app rather than under the pure node runner.)
- [x] 8.3 Update `docs/KEEP.md` and JSDoc for the new API surface.

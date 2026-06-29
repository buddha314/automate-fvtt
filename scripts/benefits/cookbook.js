/**
 * The generic benefit **cookbook** (Change A, task 6.1) — a small, system-agnostic
 * starter set shipped by the engine as reference/fallback, the way
 * `FABRICATE.SEED_SYSTEMS` is a convenience default. System-specific cookbooks
 * live in content modules (per `engine-vs-content-split`); these are the truly
 * generic benefits (rest, storage, voting) plus example role vocabularies drawn
 * from real systems so the feature feels familiar out of the box.
 *
 * Pure data + a single registrar. The data names no game system's mechanics; the
 * `effect` examples are intentionally absent (Active Effect payloads are
 * system-specific and belong to content), so the generic set uses `modifier`,
 * `capability`, and `action` primitives only.
 *
 * @module benefits/cookbook
 */

import { PRIMITIVE, MODE, CONDITION, COMBINE } from "./benefits.js";
import { registerDefinition } from "./benefit-store.js";

/**
 * Example role vocabularies (Decision 6). Roles are opaque strings — the engine
 * never hard-codes an enum; these are reference sets a GM can adopt or replace.
 * @type {Object<string, string[]>}
 */
export const EXAMPLE_ROLES = Object.freeze({
  pathfinder: ["ruler", "counselor", "general", "marshal", "treasurer", "warden", "cohort"],
  dnd: ["lord", "retainer", "artisan", "hireling", "defender"],
  mutantYearZero: ["boss", "projectLead", "resident"],
  forbiddenLands: ["owner", "hireling", "defender"],
  generic: ["owner", "citizen", "resident"],
});

/**
 * The generic, system-agnostic starter benefits.
 * @type {import("./benefits.js").BenefitDef[]}
 */
export const GENERIC_COOKBOOK = Object.freeze([
  {
    id: "generic.rest.faster",
    primitive: PRIMITIVE.MODIFIER,
    name: "Comfortable Quarters",
    description: "Members rest faster while the Keep can house them. Read by whatever implements rest.",
    payload: { key: "rest.timeMultiplier", value: 0.5, combine: COMBINE.LOWEST },
    mode: MODE.AUTO,
  },
  {
    id: "generic.storage",
    primitive: PRIMITIVE.CAPABILITY,
    name: "Storage Rights",
    description: "Grants the member storage slots in the Keep.",
    payload: { key: "storage.slots", quota: 10 },
    mode: MODE.AUTO,
  },
  {
    id: "generic.vote",
    primitive: PRIMITIVE.CAPABILITY,
    name: "Voting Privileges",
    description: "Grants the member a voice in Keep decisions.",
    payload: { key: "vote" },
    eligibility: { roles: ["owner", "citizen", "ruler", "lord", "boss"] },
    mode: MODE.AUTO,
  },
  {
    id: "generic.stockpile.withdraw",
    primitive: PRIMITIVE.CAPABILITY,
    name: "Access to Gathered Resources",
    description: "Lets the member withdraw from the Keep stockpile (engine-enforced).",
    payload: { key: "stockpile.withdraw" },
    mode: MODE.AUTO,
  },
  {
    id: "generic.summon.guard",
    primitive: PRIMITIVE.ACTION,
    name: "Summon the Guard",
    description: "Call for local law enforcement. The engine emits an event; the GM adjudicates.",
    payload: { actionId: "summonGuard", label: "Summon the Guard" },
    condition: CONDITION.WHILE_PRESENT,
    mode: MODE.INTERACTIVE,
  },
]);

/**
 * Register the generic cookbook into the benefits side module. Idempotent
 * (re-registering replaces by id), so it is safe to call on every
 * `automate-fvtt.ready`.
 */
export function registerGenericCookbook() {
  for (const def of GENERIC_COOKBOOK) registerDefinition(def);
}

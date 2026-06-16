/**
 * The benefit **importer seam** (Change A, task 6.2) — converts license-permissive
 * external content into benefit definitions for GM review. The same ingestion seam
 * as issue #20 (reuse OGL *data*, re-author *code*): importers read source data
 * and *return* normalized definitions; they never auto-commit. The GM reviews,
 * then registers/binds the ones they want.
 *
 * Pure and Foundry-agnostic so importers are unit-testable. A reference importer
 * for PF2e Kingmaker settlement structures is included; its source `data/**` is
 * OGL and reusable, so we map its shapes into our schema rather than copying code.
 *
 * @module benefits/importers
 */

import { PRIMITIVE, MODE, validateDefinition } from "./benefits.js";

/**
 * Run a source list through a mapper, returning validated definitions. Entries
 * the mapper returns `null`/`[]` for are skipped. Nothing is registered — the
 * caller (GM) decides what to commit.
 * @param {any[]} source  raw source entries
 * @param {(entry: any) => (import("./benefits.js").BenefitDef[]|import("./benefits.js").BenefitDef|null)} mapper
 * @returns {import("./benefits.js").BenefitDef[]} normalized definitions for review
 */
export function importBenefits(source, mapper) {
  const out = [];
  for (const entry of source ?? []) {
    const mapped = mapper(entry);
    if (!mapped) continue;
    for (const def of Array.isArray(mapped) ? mapped : [mapped]) {
      out.push(validateDefinition(def));
    }
  }
  return out;
}

/**
 * Reference mapper: a PF2e Kingmaker settlement structure → benefit definitions.
 * Each structure's `itemBonuses` (a bonus to a named activity/skill while in the
 * settlement) becomes a `modifier` benefit keyed `pf2e.<activity>.itemBonus`; a
 * content adapter turns that scalar into an actual pf2e bonus. Authored from the
 * OGL data shape — not copied from AGPL code/schema.
 *
 * Expected source entry shape (subset):
 * `{ name, level?, itemBonuses?: [{ activity, value }] }`
 *
 * @param {{name: string, level?: number, itemBonuses?: {activity: string, value: number}[]}} structure
 * @returns {import("./benefits.js").BenefitDef[]}
 */
export function pf2eKingmakerStructureMapper(structure) {
  const bonuses = structure?.itemBonuses ?? [];
  return bonuses
    .filter((b) => b?.activity && Number(b.value))
    .map((b) => ({
      id: `pf2e.structure.${slug(structure.name)}.${slug(b.activity)}`,
      primitive: PRIMITIVE.MODIFIER,
      name: `${structure.name}: +${b.value} ${b.activity}`,
      description: `Item bonus to ${b.activity} from the ${structure.name} structure (imported, review before use).`,
      payload: { key: `pf2e.${slug(b.activity)}.itemBonus`, value: Number(b.value) },
      // Settlement structure bonuses apply while at the settlement.
      condition: "while-present",
      // Deterministic numeric bonus — safe to auto-apply once the GM commits it.
      mode: MODE.AUTO,
    }));
}

/**
 * Convenience: import a list of PF2e Kingmaker structures into review-ready
 * definitions.
 * @param {any[]} structures
 * @returns {import("./benefits.js").BenefitDef[]}
 */
export function importPf2eKingmakerStructures(structures) {
  return importBenefits(structures, pf2eKingmakerStructureMapper);
}

/** Lowercase kebab slug for stable benefit ids. @param {string} s @returns {string} */
function slug(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

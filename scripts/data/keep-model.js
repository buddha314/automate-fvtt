/**
 * Schema for a Keep's data.
 *
 * A Keep owns a {@link Stockpile} (a dynamic resource→quantity map) and a fixed
 * set of count-based config scalars (henchmen, garden) that drive the permanent
 * count-based economy rules in Phase 3.
 *
 * This is a **standalone** {@link foundry.abstract.DataModel}, NOT a registered
 * actor sub-type model: Keeps are core-type actors that store this payload under
 * a module flag (pf2e forbids module Actor sub-types — see `constants.KEEP_FLAG`).
 * We use the schema to validate/clean the flag data via `cleanKeepData`
 * (keep-api) rather than letting Foundry attach it to `actor.system`.
 * @module data/keep-model
 */

const fields = foundry.data.fields;

export class KeepModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      /** Scene this Keep owns. One Keep per scene is enforced in Phase 6. */
      sceneId: new fields.DocumentIdField({ required: false, nullable: true, initial: null }),

      /**
       * Resource ledger: arbitrary resource id → quantity. TypedObjectField
       * coerces every value through a NumberField, so form/sheet input arrives
       * as numbers and negatives are rejected.
       */
      stockpile: new fields.TypedObjectField(
        new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 })
      ),

      /** Count-based config scalars — never placed assets (see Phase 3). */
      counts: new fields.SchemaField({
        henchmen: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0, integer: true }),
        garden: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0, integer: true }),
      }),

      /** Ids of rules bound to this Keep (populated in Phase 3). */
      ruleIds: new fields.ArrayField(new fields.StringField({ blank: false })),

      /**
       * Port output buffers for producers set to `port` delivery: bufferKey
       * (asset/rule id) → resource → quantity held, awaiting belt routing
       * (Phase 7) or manual collection. Producers using `keep` delivery bypass
       * this and deposit straight into {@link stockpile}.
       */
      buffers: new fields.TypedObjectField(
        new fields.TypedObjectField(
          new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 })
        )
      ),
    };
  }
}

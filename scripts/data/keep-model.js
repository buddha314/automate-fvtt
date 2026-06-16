/**
 * Data model for the Keep actor sub-type (`automate-fvtt.keep`).
 *
 * A Keep owns a {@link Stockpile} (a dynamic resource→quantity map) and a fixed
 * set of count-based config scalars (henchmen, garden) that drive the permanent
 * count-based economy rules in Phase 3. Registered on `CONFIG.Actor.dataModels`
 * during init.
 * @module data/keep-model
 */

const fields = foundry.data.fields;

export class KeepModel extends foundry.abstract.TypeDataModel {
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
       * Current numeric tier of the Keep. Read by benefit eligibility (Change A);
       * the *computation* of tier from metrics is a separate change, so this is a
       * plain settable scalar for now (default 0).
       */
      tier: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0, integer: true }),

      /**
       * Membership roster (Change A). Each member references an existing PC/NPC
       * Actor by UUID plus an opaque, content-defined `role`; adding/removing a
       * member never creates or deletes the referenced Actor.
       */
      members: new fields.ArrayField(
        new fields.SchemaField({
          actorUuid: new fields.StringField({ required: true, blank: false }),
          role: new fields.StringField({ required: true, nullable: false, initial: "member" }),
          joinedAt: new fields.NumberField({ required: false, nullable: true, initial: null }),
        })
      ),

      /**
       * Lightweight references to benefit ids bound to this Keep (Decision 8).
       * The authoritative binding/state store is the benefits side module
       * (`benefits/benefit-store.js`); this is a convenience mirror for the sheet
       * and for rebuilding bindings after a reload.
       */
      boundBenefitIds: new fields.ArrayField(new fields.StringField({ blank: false })),

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

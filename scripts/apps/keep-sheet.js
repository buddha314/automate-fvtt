/**
 * Minimal Keep sheet (Phase 1) built on ApplicationV2 / ActorSheetV2.
 *
 * Lists and edits the count-based config scalars (henchmen, garden) and the
 * dynamic resource stockpile. Form changes persist to the document automatically
 * (DocumentSheetV2 with submitOnChange); add/remove resource use named actions.
 * @module apps/keep-sheet
 */

import { MODULE_ID } from "./../constants.js";
import { setResource, removeResource, addMember, removeMember } from "./../keep-api.js";
import { memberBenefitView, approveBenefit, invokeAction } from "./../benefits/benefit-engine.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class KeepSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    // NB: deliberately NOT using a bare "automate-fvtt" class — an old scaffold
    // rule (.automate-fvtt { display: contents }) would dissolve the window box.
    classes: ["keep-sheet"],
    position: { width: 520, height: "auto" },
    window: { resizable: true, icon: "fa-solid fa-chess-rook" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addResource: KeepSheet.#onAddResource,
      removeResource: KeepSheet.#onRemoveResource,
      addMember: KeepSheet.#onAddMember,
      removeMember: KeepSheet.#onRemoveMember,
      invokeBenefit: KeepSheet.#onInvokeBenefit,
      approveBenefit: KeepSheet.#onApproveBenefit,
    },
  };

  /** @override */
  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/keep-sheet.hbs` },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.document.system;
    context.keep = this.document;
    context.system = system;
    context.counts = system.counts;
    context.resources = Object.entries(system.stockpile ?? {})
      .map(([key, qty]) => ({ key, qty }))
      .sort((a, b) => a.key.localeCompare(b.key));

    // Members + their resolved benefits (Change A).
    context.members = (system.members ?? []).map((m, idx) => {
      const actor = this.#resolveActor(m.actorUuid);
      return {
        idx,
        actorUuid: m.actorUuid,
        role: m.role,
        name: actor?.name ?? m.actorUuid,
        img: actor?.img,
        benefits: memberBenefitView(this.document, m),
      };
    });

    context.editable = this.isEditable;
    return context;
  }

  /** Resolve an actor UUID for display; null on miss. @returns {Actor|null} */
  #resolveActor(uuid) {
    try {
      return fromUuidSync?.(uuid) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Add a world Actor (PC/NPC, not a Keep) to the roster, prompting for actor and role.
   * @this {KeepSheet}
   */
  static async #onAddMember() {
    const candidates = (game.actors ?? []).filter((a) => a.type !== `${MODULE_ID}.keep`);
    if (!candidates.length) {
      ui.notifications?.warn(game.i18n.localize("AUTOMATE_FVTT.Keep.NoActors"));
      return;
    }
    const options = candidates.map((a) => `<option value="${a.uuid}">${a.name}</option>`).join("");
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("AUTOMATE_FVTT.Keep.AddMemberTitle") },
      content:
        `<div class="keep-sheet__field"><label>${game.i18n.localize("AUTOMATE_FVTT.Keep.MemberActor")}</label>` +
        `<select name="actorUuid" style="width:100%">${options}</select></div>` +
        `<div class="keep-sheet__field"><label>${game.i18n.localize("AUTOMATE_FVTT.Keep.MemberRole")}</label>` +
        `<input type="text" name="role" value="member" style="width:100%" /></div>`,
      ok: {
        label: game.i18n.localize("AUTOMATE_FVTT.Keep.Add"),
        callback: (_e, button) => ({
          actorUuid: button.form.elements.actorUuid.value,
          role: button.form.elements.role.value.trim() || "member",
        }),
      },
      rejectClose: false,
    });
    if (result?.actorUuid) await addMember(this.document, result.actorUuid, result.role);
  }

  /** Remove the member named on the clicked control's `data-actor-uuid`. @this {KeepSheet} */
  static async #onRemoveMember(_event, target) {
    const uuid = target.dataset.actorUuid;
    if (uuid) await removeMember(this.document, uuid);
  }

  /** Invoke an action benefit (`data-actor-uuid`, `data-benefit`). @this {KeepSheet} */
  static async #onInvokeBenefit(_event, target) {
    const { actorUuid, benefit } = target.dataset;
    if (actorUuid && benefit) invokeAction(this.document, actorUuid, benefit);
  }

  /** Approve a pending interactive benefit, then re-render. @this {KeepSheet} */
  static async #onApproveBenefit(_event, target) {
    const { actorUuid, benefit } = target.dataset;
    if (actorUuid && benefit) await approveBenefit(this.document, actorUuid, benefit);
  }

  /**
   * Prompt for a resource id and add it at quantity 0.
   * @this {KeepSheet}
   */
  static async #onAddResource() {
    const resource = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("AUTOMATE_FVTT.Keep.AddResourceTitle") },
      content: `<input type="text" name="resource" placeholder="ore" autofocus style="width:100%" />`,
      ok: {
        label: game.i18n.localize("AUTOMATE_FVTT.Keep.Add"),
        callback: (_event, button) => button.form.elements.resource.value.trim().toLowerCase(),
      },
      rejectClose: false,
    });
    if (!resource) return;
    if (this.document.system.stockpile?.[resource] !== undefined) {
      ui.notifications?.warn(
        game.i18n.format("AUTOMATE_FVTT.Keep.ResourceExists", { resource })
      );
      return;
    }
    await setResource(this.document, resource, 0);
  }

  /**
   * Remove the resource named on the clicked control's `data-resource`.
   * @this {KeepSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveResource(_event, target) {
    const resource = target.dataset.resource;
    if (resource) await removeResource(this.document, resource);
  }
}

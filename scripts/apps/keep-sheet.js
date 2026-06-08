/**
 * Minimal Keep sheet (Phase 1) built on ApplicationV2 / ActorSheetV2.
 *
 * Lists and edits the count-based config scalars (henchmen, garden) and the
 * dynamic resource stockpile. Form changes persist to the document automatically
 * (DocumentSheetV2 with submitOnChange); add/remove resource use named actions.
 * @module apps/keep-sheet
 */

import { MODULE_ID } from "./../constants.js";
import { setResource, removeResource } from "./../keep-api.js";

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
    context.editable = this.isEditable;
    return context;
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

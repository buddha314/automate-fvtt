/**
 * Keep panel — a standalone ApplicationV2 form for a Keep actor.
 *
 * Keeps are core-type actors carrying their ledger under a module flag (pf2e
 * forbids module Actor sub-types), so we can't register a sheet *by type* without
 * hijacking every actor of that type. Instead this is an opt-in panel opened via
 * `api.keeps.open(keepOrId)` (and the Actors-directory context menu) that
 * reads/writes `flags["automate-fvtt"].keep` directly.
 *
 * Lists and edits the count-based config scalars (henchmen, garden), the dynamic
 * resource stockpile, and the membership roster with each member's resolved
 * benefits (Change A). Form changes persist on change; add/remove resource,
 * add/remove member, and invoke/approve benefit use named actions.
 * @module apps/keep-sheet
 */

import { MODULE_ID, KEEP_DATA_PATH } from "./../constants.js";
import {
  getKeepData,
  getKeep,
  isKeepActor,
  setResource,
  removeResource,
  addMember,
  removeMember,
} from "./../keep-api.js";
import { memberBenefitView, approveBenefit, invokeAction } from "./../benefits/benefit-engine.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class KeepApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options
   * @param {Actor} options.keep  the Keep actor this panel edits
   */
  constructor(options = {}) {
    super(options);
    /** @type {Actor} */
    this.keep = options.keep;
    /** @type {number|null} */
    this.#updateHookId = null;
  }

  #updateHookId;

  /** @override */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["keep-sheet"],
    position: { width: 520, height: "auto" },
    window: { resizable: true, icon: "fa-solid fa-chess-rook" },
    form: { handler: KeepApp.#onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: {
      addResource: KeepApp.#onAddResource,
      removeResource: KeepApp.#onRemoveResource,
      addMember: KeepApp.#onAddMember,
      removeMember: KeepApp.#onRemoveMember,
      invokeBenefit: KeepApp.#onInvokeBenefit,
      approveBenefit: KeepApp.#onApproveBenefit,
    },
  };

  /** @override */
  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/keep-sheet.hbs` },
  };

  /** Stable per-keep id so re-opening focuses the existing panel. @override */
  get id() {
    return `automate-fvtt-keep-${this.keep?.id ?? "unknown"}`;
  }

  /** @override */
  get title() {
    return this.keep?.name ?? "Keep";
  }

  /**
   * Open (or focus) the panel for a Keep.
   * @param {Actor|string} keepOrId
   * @returns {KeepApp|null}
   */
  static open(keepOrId) {
    const keep = typeof keepOrId === "string" ? getKeep(keepOrId) : keepOrId;
    if (!isKeepActor(keep)) {
      ui.notifications?.warn("Not a Keep actor.");
      return null;
    }
    const app = new KeepApp({ keep });
    app.render(true);
    return app;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const data = getKeepData(this.keep);
    context.keep = this.keep;
    context.counts = data.counts ?? { henchmen: 0, garden: 0 };
    context.resources = Object.entries(data.stockpile ?? {})
      .map(([key, qty]) => ({ key, qty }))
      .sort((a, b) => a.key.localeCompare(b.key));

    // Members + their resolved benefits (Change A).
    context.members = (data.members ?? []).map((m, idx) => {
      const actor = this.#resolveActor(m.actorUuid);
      return {
        idx,
        actorUuid: m.actorUuid,
        role: m.role,
        name: actor?.name ?? m.actorUuid,
        img: actor?.img,
        benefits: memberBenefitView(this.keep, m),
      };
    });

    context.editable = this.keep.isOwner;
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

  /** Re-render live when the Keep changes underneath us (economy tick, API). @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    if (this.#updateHookId != null) return;
    this.#updateHookId = Hooks.on("updateActor", (actor) => {
      if (actor?.id === this.keep?.id) this.render();
    });
  }

  /** @override */
  _onClose(options) {
    if (this.#updateHookId != null) {
      Hooks.off("updateActor", this.#updateHookId);
      this.#updateHookId = null;
    }
    super._onClose?.(options);
  }

  /**
   * Persist form edits to the actor name and the Keep flag ledger.
   * @this {KeepApp}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {{object: Record<string, unknown>}} formData
   */
  static async #onSubmit(_event, _form, formData) {
    if (!this.keep?.isOwner) return;
    const obj = foundry.utils.expandObject(formData.object);
    const update = {};
    if (typeof obj.name === "string" && obj.name !== this.keep.name) update.name = obj.name;
    for (const key of ["henchmen", "garden"]) {
      if (obj.counts?.[key] !== undefined) {
        update[`${KEEP_DATA_PATH}.counts.${key}`] = Math.max(0, Math.floor(Number(obj.counts[key]) || 0));
      }
    }
    for (const [res, qty] of Object.entries(obj.stockpile ?? {})) {
      update[`${KEEP_DATA_PATH}.stockpile.${res}`] = Math.max(0, Number(qty) || 0);
    }
    if (Object.keys(update).length) await this.keep.update(update);
  }

  /**
   * Prompt for a resource id and add it at quantity 0.
   * @this {KeepApp}
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
    if (getKeepData(this.keep).stockpile?.[resource] !== undefined) {
      ui.notifications?.warn(game.i18n.format("AUTOMATE_FVTT.Keep.ResourceExists", { resource }));
      return;
    }
    await setResource(this.keep, resource, 0);
    await this.render();
  }

  /**
   * Remove the resource named on the clicked control's `data-resource`.
   * @this {KeepApp}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveResource(_event, target) {
    const resource = target.dataset.resource;
    if (resource) {
      await removeResource(this.keep, resource);
      await this.render();
    }
  }

  /**
   * Add a world Actor (PC/NPC, not a Keep) to the roster, prompting for actor and role.
   * @this {KeepApp}
   */
  static async #onAddMember() {
    const candidates = (game.actors ?? []).filter((a) => !isKeepActor(a));
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
    if (result?.actorUuid) await addMember(this.keep, result.actorUuid, result.role);
  }

  /** Remove the member named on the clicked control's `data-actor-uuid`. @this {KeepApp} */
  static async #onRemoveMember(_event, target) {
    const uuid = target.dataset.actorUuid;
    if (uuid) await removeMember(this.keep, uuid);
  }

  /** Invoke an action benefit (`data-actor-uuid`, `data-benefit`). @this {KeepApp} */
  static async #onInvokeBenefit(_event, target) {
    const { actorUuid, benefit } = target.dataset;
    if (actorUuid && benefit) invokeAction(this.keep, actorUuid, benefit);
  }

  /** Approve a pending interactive benefit, then re-render. @this {KeepApp} */
  static async #onApproveBenefit(_event, target) {
    const { actorUuid, benefit } = target.dataset;
    if (actorUuid && benefit) await approveBenefit(this.keep, actorUuid, benefit);
  }
}

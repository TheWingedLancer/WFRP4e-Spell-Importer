/**
 * SpellImporterApp — the GM-facing window.
 *
 * Three tabs:
 *   • Pick Files  — multi-select <input type="file"> for .json
 *   • Scan Folder — Foundry FilePicker → list every .json under the path
 *   • Paste JSON  — large textarea
 *
 * After parsing, we show a preview table; the GM picks a duplicate-handling
 * strategy and clicks Import.
 */

import { parseSpellJSON, readFileAsSpells, normalizeBundle } from "./spell-parser.mjs";
import { importSpellsToPack, annotateDuplicates } from "./pack-importer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SpellImporterApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {Array<object>} Parsed + normalised spell payloads awaiting import. */
  #spells = [];

  /** @type {Array<{name:string, reason:string}>} */
  #skipped = [];

  /** @type {"files"|"folder"|"paste"} */
  #activeTab = "files";

  /** @type {"skip"|"overwrite"|"rename"} */
  #onDuplicate = "skip";

  static DEFAULT_OPTIONS = {
    id: "wfrp4e-spell-importer",
    tag: "form",
    window: {
      title: "SPELL_IMPORTER.Title",
      icon: "fas fa-file-import",
      contentClasses: ["wfrp4e-spell-importer"],
      resizable: true
    },
    position: {
      width: 720,
      height: 640
    },
    form: {
      handler: SpellImporterApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: {
      switchTab: SpellImporterApp.#onSwitchTab,
      parseFiles: SpellImporterApp.#onParseFiles,
      browseFolder: SpellImporterApp.#onBrowseFolder,
      scanFolder: SpellImporterApp.#onScanFolder,
      parsePaste: SpellImporterApp.#onParsePaste,
      clear: SpellImporterApp.#onClear,
      cancel: SpellImporterApp.#onCancel
    }
  };

  static PARTS = {
    body: {
      template: "modules/wfrp4e-spell-importer/templates/spell-importer.hbs"
    }
  };

  /** @override */
  async _prepareContext() {
    return {
      activeTab: this.#activeTab,
      tabs: ["files", "folder", "paste"],
      spells: this.#spells,
      skipped: this.#skipped,
      hasParsed: this.#spells.length > 0 || this.#skipped.length > 0,
      onDuplicate: this.#onDuplicate,
      duplicateOptions: [
        { value: "skip",      label: "SPELL_IMPORTER.Options.OnDuplicateSkip" },
        { value: "overwrite", label: "SPELL_IMPORTER.Options.OnDuplicateOverwrite" },
        { value: "rename",    label: "SPELL_IMPORTER.Options.OnDuplicateRename" }
      ]
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Tab switching                                                     */
  /* ------------------------------------------------------------------ */

  static #onSwitchTab(event, target) {
    const tab = target.dataset.tab;
    if (!tab) return;
    this.#activeTab = tab;
    this.render({ parts: ["body"] });
  }

  /* ------------------------------------------------------------------ */
  /*  Files tab                                                         */
  /* ------------------------------------------------------------------ */

  static async #onParseFiles(event, target) {
    const input = this.element.querySelector('input[name="files"]');
    const files = Array.from(input?.files ?? []);
    if (!files.length) {
      ui.notifications.warn(game.i18n.localize("SPELL_IMPORTER.Notifications.NoFiles"));
      return;
    }

    const results = await Promise.all(files.map((f) => readFileAsSpells(f)));
    const spells = [];
    const skipped = [];
    for (const r of results) {
      if (r.error) {
        skipped.push({ name: r.fileName, reason: r.error });
        continue;
      }
      spells.push(...r.spells);
      skipped.push(...r.skipped);
    }
    await this.#setParsed(spells, skipped);
  }

  /* ------------------------------------------------------------------ */
  /*  Folder tab                                                        */
  /* ------------------------------------------------------------------ */

  static async #onBrowseFolder(event, target) {
    const fp = new FilePicker({
      type: "folder",
      callback: (path) => {
        const input = this.element.querySelector('input[name="folderPath"]');
        if (input) input.value = path;
      }
    });
    fp.render(true);
  }

  static async #onScanFolder(event, target) {
    const input = this.element.querySelector('input[name="folderPath"]');
    const path = input?.value?.trim();
    if (!path) {
      ui.notifications.warn(game.i18n.localize("SPELL_IMPORTER.Notifications.NoFiles"));
      return;
    }

    let listing;
    try {
      listing = await FilePicker.browse("data", path, { extensions: [".json"] });
    } catch (err) {
      ui.notifications.error(`Could not browse "${path}": ${err.message}`);
      return;
    }

    const jsonFiles = (listing.files ?? []).filter((p) => p.toLowerCase().endsWith(".json"));
    if (!jsonFiles.length) {
      ui.notifications.warn(game.i18n.format("SPELL_IMPORTER.Notifications.BadFile", { file: path, error: "no .json files found" }));
      return;
    }

    const spells = [];
    const skipped = [];
    for (const url of jsonFiles) {
      try {
        const res = await fetch(url);
        const text = await res.text();
        const parsed = parseSpellJSON(text);
        spells.push(...parsed.spells);
        skipped.push(...parsed.skipped);
      } catch (err) {
        skipped.push({ name: url.split("/").pop(), reason: err.message });
      }
    }

    await this.#setParsed(spells, skipped);
  }

  /* ------------------------------------------------------------------ */
  /*  Paste tab                                                         */
  /* ------------------------------------------------------------------ */

  static async #onParsePaste(event, target) {
    const ta = this.element.querySelector('textarea[name="pasted"]');
    const text = ta?.value?.trim();
    if (!text) {
      ui.notifications.warn(game.i18n.localize("SPELL_IMPORTER.Notifications.NoText"));
      return;
    }
    try {
      const { spells, skipped } = parseSpellJSON(text);
      await this.#setParsed(spells, skipped);
    } catch (err) {
      ui.notifications.error(game.i18n.format("SPELL_IMPORTER.Notifications.BadJSON", { error: err.message }));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Preview / commit                                                  */
  /* ------------------------------------------------------------------ */

  async #setParsed(spells, skipped) {
    // Annotate duplicates against the live compendium so the preview can
    // show "already in pack" badges.
    this.#spells = await annotateDuplicates(spells);
    this.#skipped = skipped;
    this.render({ parts: ["body"] });
  }

  static #onClear() {
    this.#spells = [];
    this.#skipped = [];
    this.render({ parts: ["body"] });
  }

  static #onCancel() {
    this.close();
  }

  /**
   * Form submit handler — runs the actual import.
   */
  static async #onSubmit(event, form, formData) {
    if (!game.user.isGM) {
      ui.notifications.error(game.i18n.localize("SPELL_IMPORTER.Notifications.PermissionDenied"));
      return;
    }
    if (!this.#spells.length) {
      ui.notifications.warn(game.i18n.localize("SPELL_IMPORTER.Notifications.NoFiles"));
      return;
    }

    const data = formData.object ?? {};
    this.#onDuplicate = data.onDuplicate ?? this.#onDuplicate;

    const stats = await importSpellsToPack(this.#spells, { onDuplicate: this.#onDuplicate });

    ui.notifications.info(game.i18n.format("SPELL_IMPORTER.Notifications.Success", {
      created: stats.created,
      updated: stats.updated,
      skipped: stats.skipped
    }));

    if (stats.errors.length) {
      console.warn("wfrp4e-spell-importer | Import errors:", stats.errors);
    }

    this.close();
  }
}

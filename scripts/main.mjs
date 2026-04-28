/**
 * WFRP4e Spell Importer — entry point
 *
 * Adds an "Import Spells" button to the Compendium directory header so the GM
 * can launch the bulk importer at any time. Also exposes a console helper
 * (`game.modules.get("wfrp4e-spell-importer").api.open()`) for macros.
 */

import { SpellImporterApp } from "./spell-importer-app.mjs";

const MODULE_ID = "wfrp4e-spell-importer";
const PACK_ID = `${MODULE_ID}.imported-spells`;

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initialising`);

  // Public API for macros / other modules.
  const mod = game.modules.get(MODULE_ID);
  mod.api = {
    open: () => new SpellImporterApp().render(true),
    PACK_ID
  };
});

/**
 * Inject an "Import Spells" button into the Compendium directory sidebar.
 * In V13 the sidebar tab fires `renderCompendiumDirectory` for the
 * ApplicationV2-based directory; we add a button to its header actions.
 */
Hooks.on("renderCompendiumDirectory", (app, html) => {
  if (!game.user.isGM) return;

  // `html` may be a jQuery object or a raw HTMLElement depending on Foundry
  // version — normalise to an HTMLElement.
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  // Avoid double-injection on re-render.
  if (root.querySelector(`.${MODULE_ID}-open`)) return;

  const header = root.querySelector(".directory-header") ?? root.querySelector("header");
  if (!header) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `${MODULE_ID}-open`;
  btn.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize("SPELL_IMPORTER.OpenButton")}`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    new SpellImporterApp().render(true);
  });

  header.appendChild(btn);
});

/**
 * Also expose a Scene Controls macro shortcut: a hotkey to open the importer.
 */
Hooks.once("ready", () => {
  game.keybindings.register(MODULE_ID, "open-importer", {
    name: "SPELL_IMPORTER.OpenButton",
    editable: [{ key: "KeyI", modifiers: ["Control", "Shift"] }],
    onDown: () => {
      if (!game.user.isGM) return false;
      new SpellImporterApp().render(true);
      return true;
    },
    restricted: true
  });
});

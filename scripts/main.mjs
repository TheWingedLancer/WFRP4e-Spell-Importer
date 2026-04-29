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
 *
 * V13's compendium directory header has this structure:
 *   <header class="directory-header">
 *     <div class="header-actions">    ← native buttons live here
 *       <button class="create-entry">...</button>
 *       <button class="create-folder">...</button>
 *       <button class="open-compendium-browser">...</button>
 *     </div>
 *     <search>...</search>
 *   </header>
 *
 * To get matching styling, we must (a) inject INTO .header-actions, not
 * after it, and (b) match the native HTML structure: <i> + <span>text</span>.
 */
Hooks.on("renderCompendiumDirectory", (app, html) => {
  if (!game.user.isGM) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  // Avoid double-injection on re-render.
  if (root.querySelector(`.${MODULE_ID}-open`)) return;

  const headerActions = root.querySelector(".directory-header .header-actions")
    ?? root.querySelector(".header-actions");
  if (!headerActions) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `create-entry ${MODULE_ID}-open`;
  btn.innerHTML = `<i class="fa-solid fa-file-import" inert></i><span>${game.i18n.localize("SPELL_IMPORTER.OpenButton")}</span>`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    new SpellImporterApp().render(true);
  });

  headerActions.appendChild(btn);
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

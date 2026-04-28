# WFRP4e Spell Importer

A FoundryVTT module for **Warhammer Fantasy Roleplay 4th Edition** that bulk-imports spell JSON files into a dedicated compendium pack. Imported spells are fully functional and can be dragged onto any character sheet.

## Features

- **Three input methods**:
  - Multi-select file picker (pick a bunch of `.json` files at once)
  - Folder scan (point at a Foundry data folder, every `.json` inside is parsed)
  - Paste a JSON object or array directly into a textarea
- **Standard format**: accepts the WFRP4e item export format used when you right-click an item in a world or compendium and choose *Export Data*. Also accepts world export bundles (`{ "Item": [...] }`) and arrays.
- **Preview before commit**: see name, lore, CN, range, target, duration, damage; duplicates against the existing pack are flagged.
- **Duplicate handling**: skip / overwrite / rename (auto-suffix).
- **Dedicated compendium pack** (`Imported Spells`) so spells stay portable across worlds.

## Installation

In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

```
https://github.com/TheWingedLancer/WFRP4e-Spell-Importer/releases/latest/download/module.json
```

Forge VTT users: same URL works in the Bazaar's "Manifest URL" field.

## Usage

1. Enable the module in your world.
2. Open the **Compendium Packs** sidebar tab. You'll see an **Import Spells** button at the top.
   - Or use the keybinding **Ctrl+Shift+I** (GM only).
   - Or call `game.modules.get("wfrp4e-spell-importer").api.open()` from a macro.
3. Pick files, scan a folder, or paste JSON.
4. Click **Parse**. Review the preview table.
5. Pick a duplicate strategy and click **Import**.
6. Drag spells from the **Imported Spells** compendium onto any actor.

## Expected JSON shape

A standard exported WFRP4e spell looks like:

```json
{
  "name": "Dart",
  "type": "spell",
  "img": "icons/magic/symbols/runes-star-orange.webp",
  "system": {
    "description": { "value": "<p>You point a finger at your target...</p>" },
    "lore": { "value": "petty" },
    "cn": { "value": 0 },
    "range": { "value": "WPB yards" },
    "target": { "value": "1" },
    "duration": { "value": "Instant" },
    "damage": { "value": "+2" },
    "magicMissile": { "value": true }
  },
  "effects": []
}
```

The importer will accept any of these wrappers:

- A single object
- A bare array `[ {...}, {...} ]`
- A Foundry world-export bundle `{ "Item": [...] }`
- An object with `items` or `spells` keys

Anything whose `type` is not `"spell"` (or absent) will be listed in the *Skipped* section.

## Development

Module structure:

```
wfrp4e-spell-importer/
├── module.json                       # Manifest
├── scripts/
│   ├── main.mjs                      # Init + UI hooks
│   ├── spell-importer-app.mjs        # ApplicationV2 window
│   ├── spell-parser.mjs              # JSON → normalised payload
│   └── pack-importer.mjs             # Compendium read/write
├── templates/spell-importer.hbs
├── styles/spell-importer.css
├── languages/en.json
└── packs/imported-spells/            # Compendium pack (created on first import)
```

Built for Foundry V13 (ApplicationV2 + HandlebarsApplicationMixin) and WFRP4e ≥ 8.0.

## License

MIT

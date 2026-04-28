/**
 * Compendium importer — given an array of normalised spell payloads,
 * write them into the module's compendium pack.
 *
 * Strategies for name collisions:
 *   "skip"      → leave the existing entry alone
 *   "overwrite" → update the existing entry's data in place
 *   "rename"    → import as a new entry with " (2)", " (3)", ... suffix
 */

const PACK_ID = "wfrp4e-spell-importer.imported-spells";

/**
 * Import spells into the compendium.
 *
 * @param {Array<object>} spells       Output of parseSpellJSON / readFileAsSpells.
 * @param {object}        options
 * @param {"skip"|"overwrite"|"rename"} [options.onDuplicate="skip"]
 * @returns {Promise<{created:number, updated:number, skipped:number, errors:Array}>}
 */
export async function importSpellsToPack(spells, { onDuplicate = "skip" } = {}) {
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    throw new Error(game.i18n.localize("SPELL_IMPORTER.Notifications.PackMissing"));
  }
  if (pack.locked) {
    await pack.configure({ locked: false });
  }

  // Index the pack so we can detect duplicates by name without loading every
  // document in full.
  const index = await pack.getIndex({ fields: ["name"] });

  const stats = { created: 0, updated: 0, skipped: 0, errors: [] };
  const toCreate = [];

  for (const spell of spells) {
    try {
      const existing = index.find((e) => e.name === spell.name);

      if (!existing) {
        toCreate.push(spell);
        continue;
      }

      switch (onDuplicate) {
        case "skip": {
          stats.skipped += 1;
          break;
        }
        case "overwrite": {
          // updateDocuments wants an _id; pull it from the index entry.
          const updateData = foundry.utils.deepClone(spell);
          updateData._id = existing._id;
          await Item.updateDocuments([updateData], { pack: PACK_ID, diff: false, recursive: false });
          stats.updated += 1;
          break;
        }
        case "rename": {
          spell.name = nextAvailableName(spell.name, index);
          toCreate.push(spell);
          break;
        }
        default:
          stats.skipped += 1;
      }
    } catch (err) {
      stats.errors.push({ name: spell?.name, message: err.message });
    }
  }

  if (toCreate.length) {
    try {
      const created = await Item.createDocuments(toCreate, { pack: PACK_ID, keepEmbeddedIds: false });
      stats.created += Array.isArray(created) ? created.length : 0;
    } catch (err) {
      stats.errors.push({ name: "(batch create)", message: err.message });
    }
  }

  return stats;
}

/**
 * Find a name like "Dart (2)" that does not collide with anything in the
 * compendium index.
 */
function nextAvailableName(baseName, index) {
  let i = 2;
  let candidate = `${baseName} (${i})`;
  while (index.some((e) => e.name === candidate)) {
    i += 1;
    candidate = `${baseName} (${i})`;
  }
  return candidate;
}

/**
 * Compute, for each parsed spell, whether it would collide with an existing
 * compendium entry. Used by the preview UI.
 */
export async function annotateDuplicates(spells) {
  const pack = game.packs.get(PACK_ID);
  if (!pack) return spells.map((s) => ({ ...s, duplicate: false }));
  const index = await pack.getIndex({ fields: ["name"] });
  const existingNames = new Set(index.map((e) => e.name));
  return spells.map((s) => ({ ...s, duplicate: existingNames.has(s.name) }));
}

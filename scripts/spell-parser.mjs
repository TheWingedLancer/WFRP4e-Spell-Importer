/**
 * Spell parser — turns raw JSON text into a list of Foundry-ready spell
 * Item creation payloads.
 *
 * Accepts any of these shapes (the standard WFRP4e export forms):
 *   1. A single spell:           { "name": "Dart", "type": "spell", "system": {...} }
 *   2. An array of spells:       [ {...}, {...} ]
 *   3. A Foundry "exported"      { "Item": [ {...}, {...} ] }       // Foundry world export
 *      bundle wrapper:           { "items": [ ... ] }                // Common alt key
 *   4. Anything with an _id is fine — we'll strip it on import.
 */

const SPELL_TYPE = "spell";

/**
 * Top-level: parse a JSON string into normalised spell payloads.
 * Returns { spells: Array<Item creation data>, skipped: Array<{name, reason}> }.
 */
export function parseSpellJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }
  return normalizeBundle(data);
}

/**
 * Same as parseSpellJSON but takes an already-parsed value (e.g. from a File
 * read via FileReader's readAsText + JSON.parse, or directly from an object).
 */
export function normalizeBundle(data) {
  const candidates = extractCandidates(data);
  const spells = [];
  const skipped = [];

  for (const raw of candidates) {
    const result = normalizeSpell(raw);
    if (result.ok) spells.push(result.data);
    else skipped.push({ name: raw?.name ?? "(unnamed)", reason: result.reason });
  }

  return { spells, skipped };
}

/**
 * Pull a flat list of candidate item objects out of whatever wrapper format
 * we were handed.
 */
function extractCandidates(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  // Foundry world export: { "Item": [...] }
  if (Array.isArray(data.Item)) return data.Item;
  // Some custom exporters use lowercase or `items`.
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.spells)) return data.spells;

  // Single object with a name + type → treat as one item.
  if (typeof data.name === "string") return [data];

  return [];
}

/**
 * Validate and clean a single raw spell object.
 *
 * Returns either:
 *   { ok: true,  data: <Item create payload> }
 *   { ok: false, reason: "..." }
 */
export function normalizeSpell(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Not an object" };
  }
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    return { ok: false, reason: "Missing name" };
  }
  if (raw.type && raw.type !== SPELL_TYPE) {
    return { ok: false, reason: `type was "${raw.type}", expected "spell"` };
  }

  // Build a clean payload. We keep system + effects + flags + img exactly as
  // exported (the standard WFRP4e shape) and strip database-only fields.
  const payload = {
    name: raw.name.trim(),
    type: SPELL_TYPE,
    img: raw.img ?? "icons/magic/symbols/runes-star-orange.webp",
    system: foundry.utils.deepClone(raw.system ?? {}),
    effects: Array.isArray(raw.effects) ? raw.effects.map(cleanEffect) : [],
    flags: foundry.utils.deepClone(raw.flags ?? {})
  };

  // Some exporters store the description inline on `description` instead of
  // `system.description.value` — accept either.
  if (!payload.system.description && typeof raw.description === "string") {
    payload.system.description = { value: raw.description };
  }

  // Ensure required nested shapes exist with sensible defaults so the WFRP4e
  // sheet doesn't choke on missing fields.
  payload.system.description ??= { value: "" };
  payload.system.lore ??= { value: "petty" };
  payload.system.cn ??= { value: 0 };
  payload.system.range ??= { value: "" };
  payload.system.target ??= { value: "" };
  payload.system.duration ??= { value: "" };
  payload.system.damage ??= { value: "" };
  payload.system.magicMissile ??= { value: false };
  payload.system.wind ??= { value: "" };
  payload.system.overcasts ??= {};

  return { ok: true, data: payload };
}

/**
 * Drop database-only fields from an embedded effect.
 */
function cleanEffect(effect) {
  if (!effect || typeof effect !== "object") return effect;
  const cleaned = foundry.utils.deepClone(effect);
  delete cleaned._id;
  delete cleaned.origin;   // origin gets re-derived when the effect is created
  return cleaned;
}

/**
 * Read a single File object as text and parse it. Returns
 * { fileName, spells, skipped, error? }.
 */
export async function readFileAsSpells(file) {
  try {
    const text = await file.text();
    const { spells, skipped } = parseSpellJSON(text);
    return { fileName: file.name, spells, skipped };
  } catch (err) {
    return { fileName: file.name, spells: [], skipped: [], error: err.message };
  }
}

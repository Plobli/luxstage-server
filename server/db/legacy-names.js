// Übersetzt alte Namen (bar/zug/floorplan) in die aktuellen (batten/drawing plan).
// Genutzt von Migration 051 und beim Wiederherstellen alter Snapshots (Undo/Redo,
// Mandanten-Backups), die vor der Umbenennung geschrieben wurden.

const BATTEN_TYPE_VALUES = { zugstange: 'batten', punktzug: 'point_batten' }
const JSON_STRING_KEYS = new Set(['canvas_data', 'mount_ref', 'canvasData', 'mountRef'])

export function legacyKey(key) {
  if (key === 'floorplan') return 'drawingPlan'
  if (key === 'floorplans') return 'drawingPlans'
  return key
    .replace('zug_nr', 'batten_nr')
    .replace('zugNr', 'battenNr')
    .replace(/(^|_)bar(s?)(?=_|$)/g, '$1batten$2')
    .replace(/^bar(s?)(?=[A-Z])/, 'batten$1')
    .replace(/([a-z])Bar(s?)(?=[A-Z]|$)/g, '$1Batten$2')
}

function legacyValue(key, value) {
  if (key === 'type' && value === 'bar') return 'batten'
  if (/^batten_?type$/i.test(legacyKey(key)) && BATTEN_TYPE_VALUES[value]) return BATTEN_TYPE_VALUES[value]
  return value
}

// Tiefer Walk über Objekte/Arrays. Strings in JSON_STRING_KEYS sind verschachteltes JSON.
export function upgradeLegacyNames(node, key = '') {
  if (Array.isArray(node)) return node.map(item => upgradeLegacyNames(item, key))
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[legacyKey(k)] = upgradeLegacyNames(v, k)
    return out
  }
  if (typeof node === 'string') {
    if (JSON_STRING_KEYS.has(key) && /^\s*[[{]/.test(node)) {
      try { return JSON.stringify(upgradeLegacyNames(JSON.parse(node))) } catch { return node }
    }
    return legacyValue(key, node)
  }
  return node
}

// Für Spalten mit JSON-Text. Nicht parsebare Werte bleiben unverändert.
export function upgradeLegacyJsonText(text) {
  if (typeof text !== 'string' || !/^\s*[[{]/.test(text)) return text
  try { return JSON.stringify(upgradeLegacyNames(JSON.parse(text))) } catch { return text }
}

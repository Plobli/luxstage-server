import { getDb } from '../db-context.js'
import { sectionTypeHasRows } from '../../shared/constants.js'

// Gemeinsamer Lesepfad für Section-Definitionen (KV-Rows/Fields je nach Typ), genutzt von
// sections.js (Show-Scope, section_*-Tabellen) und template-sections.js (Template-Scope,
// template_section_*-Tabellen) — identische Zuordnungslogik, nur Tabellennamen unterscheiden
// sich. Der Schreibpfad wird bewusst NICHT hier zusammengelegt: writeShowSectionDefs hat einen
// Content-Preservation-Sonderfall (section_contents/touchLastEdited), den writeTemplateSections
// nicht kennt, und Letzteres hat wiederum eine eigene Template-Upsert-Logik.
export function readSectionDefsCore(defsTable, rowsTable, fieldsTable, scopeColumn, scopeId) {
  const defs = getDb().prepare(`SELECT * FROM ${defsTable} WHERE ${scopeColumn} = ? ORDER BY sort_order`).all(scopeId)
  if (!defs.length) return []
  const defIds = defs.map(d => d.id)
  const ph = defIds.map(() => '?').join(',')
  const rowsAll = getDb().prepare(`SELECT * FROM ${rowsTable} WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const fieldsAll = getDb().prepare(`SELECT * FROM ${fieldsTable} WHERE section_id IN (${ph}) ORDER BY sort_order`).all(defIds)
  const rowsBySection = Map.groupBy(rowsAll, r => r.section_id)
  const fieldsBySection = Map.groupBy(fieldsAll, f => f.section_id)
  return defs.map(def => sectionTypeHasRows(def.type)
    ? {
        id: def.id, title: def.title, type: def.type, icon: def.icon ?? '', order: def.sort_order,
        rows: (rowsBySection.get(def.id) ?? []).map(r => ({ id: r.id, label: r.label, value: r.value, sort_order: r.sort_order })),
      }
    : {
        id: def.id, title: def.title, type: def.type, icon: def.icon ?? '', order: def.sort_order,
        fields: (fieldsBySection.get(def.id) ?? []).map(f => ({ id: f.id, key: f.key, label: f.label, unit: f.unit })),
      })
}

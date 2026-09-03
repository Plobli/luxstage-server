import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'
import { sectionTypeHasRows } from '../../shared/constants.js'
import { readSectionDefsCore } from './section-defs-core.js'

export function readTemplateSections(name) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return readSectionDefsCore('template_section_defs', 'template_section_kv_rows', 'template_section_fields', 'template_id', tpl.id)
}

export function writeTemplateSections(name, defs) {
  const insertDef   = getDb().prepare('INSERT INTO template_section_defs (id, template_id, title, type, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertKvRow = getDb().prepare('INSERT INTO template_section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertField = getDb().prepare('INSERT INTO template_section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const tx = getDb().transaction(() => {
    const now = Date.now()
    let tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
    if (!tpl) {
      const id = randomUUID()
      getDb().prepare('INSERT INTO templates (id, name, updated_at) VALUES (?, ?, ?)').run(id, name, now)
      tpl = { id }
    } else {
      getDb().prepare('UPDATE templates SET updated_at = ? WHERE id = ?').run(now, tpl.id)
    }
    getDb().prepare('DELETE FROM template_section_defs WHERE template_id = ?').run(tpl.id)
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      insertDef.run(def.id ?? randomUUID(), tpl.id, def.title, def.type, def.icon ?? '', def.order ?? i)
      if (sectionTypeHasRows(def.type)) {
        for (let j = 0; j < (def.rows ?? []).length; j++) {
          const r = def.rows[j]
          insertKvRow.run(r.id ?? randomUUID(), def.id, r.label ?? '', r.value ?? '', r.sort_order ?? j)
        }
      } else {
        for (let j = 0; j < (def.fields ?? []).length; j++) {
          const f = def.fields[j]
          insertField.run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
        }
      }
    }
  })
  tx()
}

export function deleteTemplateSections(name) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return
  getDb().prepare('DELETE FROM template_section_defs WHERE template_id = ?').run(tpl.id)
}

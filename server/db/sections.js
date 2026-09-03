import { getDb } from '../db-context.js'
import { readShow, touchLastEdited } from './shows.js'
import { randomUUID } from 'node:crypto'
import { sectionTypeHasRows } from '../../shared/constants.js'
import { readSectionDefsCore } from './section-defs-core.js'

function now() { return Date.now() }

export function readShowSectionDefs(slug) {
  const show = readShow(slug)
  if (!show) return []
  return readSectionDefsCore('section_defs', 'section_kv_rows', 'section_fields', 'show_id', show.id)
}

export function writeShowSectionDefs(slug, defs, editedBy = null) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const insertDef     = getDb().prepare('INSERT INTO section_defs (id, show_id, title, type, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertKvRow   = getDb().prepare('INSERT INTO section_kv_rows (id, section_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
  const insertField   = getDb().prepare('INSERT INTO section_fields (id, section_id, key, label, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
  const insertContent = getDb().prepare('INSERT INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
  const tx = getDb().transaction(() => {
    const savedContents = getDb().prepare('SELECT section_id, content FROM section_contents WHERE show_id = ?').all(show.id)
    const contentMap = new Map(savedContents.map(r => [r.section_id, r.content]))
    getDb().prepare('DELETE FROM section_defs WHERE show_id = ?').run(show.id)
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]
      insertDef.run(def.id, show.id, def.title, def.type, def.icon ?? '', def.order ?? i)
      if (sectionTypeHasRows(def.type)) {
        const rows = def.rows ?? []
        for (let j = 0; j < rows.length; j++) {
          const r = rows[j]
          insertKvRow.run(r.id ?? randomUUID(), def.id, r.label ?? '', r.value ?? '', r.sort_order ?? j)
        }
      } else {
        const fields = def.fields ?? []
        for (let j = 0; j < fields.length; j++) {
          const f = fields[j]
          insertField.run(f.id ?? randomUUID(), def.id, f.key, f.label ?? '', f.unit ?? '', j)
        }
        insertContent.run(def.id, show.id, contentMap.get(def.id) ?? (def.type === 'fields' ? '{}' : ''))
      }
    }
    getDb().prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
    if (editedBy) touchLastEdited(show.id, editedBy)
  })
  tx()
}

export function readShowSections(slug) {
  const show = readShow(slug)
  if (!show) return new Map()
  const rows = getDb().prepare(`
    SELECT sc.section_id, sc.content FROM section_contents sc
    WHERE sc.show_id = ?
  `).all(show.id)
  return new Map(rows.map(r => [r.section_id, r.content ?? '']))
}

export function writeShowSections(slug, map, editedBy = null) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const upsertContent = getDb().prepare('INSERT OR REPLACE INTO section_contents (section_id, show_id, content) VALUES (?, ?, ?)')
  const tx = getDb().transaction(() => {
    for (const [sectionId, content] of map) upsertContent.run(sectionId, show.id, content)
    getDb().prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
    if (editedBy) touchLastEdited(show.id, editedBy)
  })
  tx()
}

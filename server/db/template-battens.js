import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'

export function readTemplateBattens(name) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return getDb().prepare('SELECT * FROM template_battens WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
}

export function writeTemplateBatten(name, data) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) throw new Error(`Template not found: ${name}`)
  const id = data.id || randomUUID()
  // Auf template_id einschränken: sonst könnte eine fremde batten-ID (aus einem
  // anderen Template) hier aktualisiert werden.
  const existing = getDb().prepare('SELECT * FROM template_battens WHERE id = ? AND template_id = ?').get(id, tpl.id)
  if (existing) {
    getDb().prepare(
      'UPDATE template_battens SET name=?, batten_nr=?, length_cm=?, sort_order=?, batten_type=? WHERE id=?'
    ).run(data.name ?? '', data.batten_nr ?? '', data.length_cm ?? 600, data.sort_order ?? existing.sort_order ?? 0, data.batten_type ?? existing.batten_type ?? 'batten', id)
  } else {
    const count = getDb().prepare('SELECT COUNT(*) as n FROM template_battens WHERE template_id = ?').get(tpl.id).n
    getDb().prepare(
      'INSERT INTO template_battens (id, template_id, name, batten_nr, length_cm, sort_order, batten_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, tpl.id, data.name ?? '', data.batten_nr ?? '', data.length_cm ?? 600, data.sort_order ?? count, data.batten_type ?? 'batten')
  }
  return id
}

export function deleteTemplateBatten(name, battenId) {
  getDb().prepare(`
    DELETE FROM template_battens WHERE id = ?
    AND template_id IN (SELECT id FROM templates WHERE name = ?)
  `).run(battenId, name)
}

export function reorderTemplateBattens(templateId, orderedIds) {
  const update = getDb().prepare('UPDATE template_battens SET sort_order = ? WHERE id = ? AND template_id = ?')
  const tx = getDb().transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, templateId))
  })
  tx()
}

export function readTemplateBattenFixtures(battenId) {
  return getDb().prepare('SELECT * FROM template_batten_fixtures WHERE batten_id = ? ORDER BY position').all(battenId)
}

// Auf template_id einschränken: sonst ließe sich eine Fixture auf eine batten-ID
// eines fremden Templates anlegen/verschieben.
export function writeTemplateBattenFixture(name, battenId, data) {
  const batten = getDb().prepare(`
    SELECT tb.id FROM template_battens tb JOIN templates t ON t.id = tb.template_id
    WHERE tb.id = ? AND t.name = ?
  `).get(battenId, name)
  if (!batten) throw new Error(`Batten nicht in diesem Template: ${battenId}`)

  const id = data.id || randomUUID()
  const existing = getDb().prepare('SELECT id FROM template_batten_fixtures WHERE id = ? AND batten_id = ?').get(id, battenId)
  if (existing) {
    getDb().prepare(
      'UPDATE template_batten_fixtures SET position=?, channel=?, device=?, color=?, notes=?, side=?, position_text=? WHERE id=?'
    ).run(data.position ?? 0, data.channel ?? null, data.device ?? null, data.color ?? null, data.notes ?? '', data.side ?? 'out', data.position_text ?? '', id)
  } else {
    getDb().prepare(
      'INSERT INTO template_batten_fixtures (id, batten_id, position, channel, device, color, notes, side, position_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, battenId, data.position ?? 0, data.channel ?? null, data.device ?? null, data.color ?? null, data.notes ?? '', data.side ?? 'out', data.position_text ?? '')
  }
  return id
}

export function deleteTemplateBattenFixture(name, fixtureId) {
  getDb().prepare(`
    DELETE FROM template_batten_fixtures WHERE id = ?
    AND batten_id IN (SELECT tb.id FROM template_battens tb JOIN templates t ON t.id = tb.template_id WHERE t.name = ?)
  `).run(fixtureId, name)
}

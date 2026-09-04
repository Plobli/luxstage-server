import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'

export function readTemplateBars(name) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return getDb().prepare('SELECT * FROM template_bars WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
}

export function writeTemplateBar(name, data) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) throw new Error(`Template not found: ${name}`)
  const id = data.id || randomUUID()
  // Auf template_id einschränken: sonst könnte eine fremde bar-ID (aus einem
  // anderen Template) hier aktualisiert werden.
  const existing = getDb().prepare('SELECT * FROM template_bars WHERE id = ? AND template_id = ?').get(id, tpl.id)
  if (existing) {
    getDb().prepare(
      'UPDATE template_bars SET name=?, zug_nr=?, length_cm=?, sort_order=?, bar_type=? WHERE id=?'
    ).run(data.name ?? '', data.zug_nr ?? '', data.length_cm ?? 600, data.sort_order ?? existing.sort_order ?? 0, data.bar_type ?? existing.bar_type ?? 'zugstange', id)
  } else {
    const count = getDb().prepare('SELECT COUNT(*) as n FROM template_bars WHERE template_id = ?').get(tpl.id).n
    getDb().prepare(
      'INSERT INTO template_bars (id, template_id, name, zug_nr, length_cm, sort_order, bar_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, tpl.id, data.name ?? '', data.zug_nr ?? '', data.length_cm ?? 600, data.sort_order ?? count, data.bar_type ?? 'zugstange')
  }
  return id
}

export function deleteTemplateBar(name, barId) {
  getDb().prepare(`
    DELETE FROM template_bars WHERE id = ?
    AND template_id IN (SELECT id FROM templates WHERE name = ?)
  `).run(barId, name)
}

export function reorderTemplateBars(templateId, orderedIds) {
  const update = getDb().prepare('UPDATE template_bars SET sort_order = ? WHERE id = ? AND template_id = ?')
  const tx = getDb().transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, templateId))
  })
  tx()
}

export function readTemplateBarFixtures(barId) {
  return getDb().prepare('SELECT * FROM template_bar_fixtures WHERE bar_id = ? ORDER BY position').all(barId)
}

// Auf template_id einschränken: sonst ließe sich eine Fixture auf eine bar-ID
// eines fremden Templates anlegen/verschieben.
export function writeTemplateBarFixture(name, barId, data) {
  const bar = getDb().prepare(`
    SELECT tb.id FROM template_bars tb JOIN templates t ON t.id = tb.template_id
    WHERE tb.id = ? AND t.name = ?
  `).get(barId, name)
  if (!bar) throw new Error(`Bar nicht in diesem Template: ${barId}`)

  const id = data.id || randomUUID()
  const existing = getDb().prepare('SELECT id FROM template_bar_fixtures WHERE id = ? AND bar_id = ?').get(id, barId)
  if (existing) {
    getDb().prepare(
      'UPDATE template_bar_fixtures SET position=?, channel=?, device=?, color=?, notes=?, side=?, position_text=? WHERE id=?'
    ).run(data.position ?? 0, data.channel ?? null, data.device ?? null, data.color ?? null, data.notes ?? '', data.side ?? 'out', data.position_text ?? '', id)
  } else {
    getDb().prepare(
      'INSERT INTO template_bar_fixtures (id, bar_id, position, channel, device, color, notes, side, position_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, barId, data.position ?? 0, data.channel ?? null, data.device ?? null, data.color ?? null, data.notes ?? '', data.side ?? 'out', data.position_text ?? '')
  }
  return id
}

export function deleteTemplateBarFixture(name, fixtureId) {
  getDb().prepare(`
    DELETE FROM template_bar_fixtures WHERE id = ?
    AND bar_id IN (SELECT tb.id FROM template_bars tb JOIN templates t ON t.id = tb.template_id WHERE t.name = ?)
  `).run(fixtureId, name)
}

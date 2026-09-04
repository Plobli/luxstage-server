import { getDb } from '../db-context.js'
import { readTowersWithSlotsCore } from './tower-read-core.js'
import { randomUUID } from 'node:crypto'

export function readTemplateTowers(name) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return readTowersWithSlotsCore('template_towers', 'template_tower_slots', 'template_id', tpl.id)
}

export function writeTemplateTower(name, data) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) throw new Error(`Template not found: ${name}`)
  const id = data.id || randomUUID()
  // Auf template_id einschränken: sonst könnte eine fremde tower-ID (aus
  // einem anderen Template) hier aktualisiert werden.
  const existing = getDb().prepare('SELECT id FROM template_towers WHERE id = ? AND template_id = ?').get(id, tpl.id)
  if (existing) {
    getDb().prepare(
      'UPDATE template_towers SET name=?, side=?, stage_area=?, slot_count=?, sort_order=? WHERE id=?'
    ).run(data.name ?? '', data.side ?? '', data.stage_area ?? '', data.slot_count ?? 4, data.sort_order ?? 0, id)
  } else {
    const count = getDb().prepare('SELECT COUNT(*) as n FROM template_towers WHERE template_id = ?').get(tpl.id).n
    getDb().prepare(
      'INSERT INTO template_towers (id, template_id, name, side, stage_area, slot_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, tpl.id, data.name ?? '', data.side ?? '', data.stage_area ?? '', data.slot_count ?? 4, data.sort_order ?? count)
  }
  return id
}

export function deleteTemplateTower(name, towerId) {
  getDb().prepare(`
    DELETE FROM template_towers WHERE id = ?
    AND template_id IN (SELECT id FROM templates WHERE name = ?)
  `).run(towerId, name)
}

export function reorderTemplateTowers(templateId, orderedIds) {
  const update = getDb().prepare('UPDATE template_towers SET sort_order = ? WHERE id = ? AND template_id = ?')
  const tx = getDb().transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, templateId))
  })
  tx()
}

// Auf template_id einschränken: sonst ließe sich ein Slot einer fremden
// tower-ID (aus einem anderen Template) hier beschreiben.
export function writeTemplateTowerSlot(name, towerId, slotIndex, data) {
  const tower = getDb().prepare(`
    SELECT tt.id FROM template_towers tt JOIN templates t ON t.id = tt.template_id
    WHERE tt.id = ? AND t.name = ?
  `).get(towerId, name)
  if (!tower) throw new Error(`Turm nicht in diesem Template: ${towerId}`)

  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO template_tower_slots (id, tower_id, slot_index, channel, device, color)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(tower_id, slot_index) DO UPDATE SET channel=excluded.channel, device=excluded.device, color=excluded.color
  `).run(id, towerId, slotIndex, data.channel ?? null, data.device ?? null, data.color ?? null)
}

export function clearTemplateTowerSlot(name, towerId, slotIndex) {
  getDb().prepare(`
    UPDATE template_tower_slots SET channel=NULL, device=NULL, color=NULL
    WHERE tower_id = ? AND slot_index = ?
    AND tower_id IN (SELECT tt.id FROM template_towers tt JOIN templates t ON t.id = tt.template_id WHERE t.name = ?)
  `).run(towerId, slotIndex, name)
}

export function ensureTemplateTowerSlots(towerId, slotCount) {
  for (let i = 1; i <= slotCount; i++) {
    const exists = getDb().prepare(
      'SELECT id FROM template_tower_slots WHERE tower_id = ? AND slot_index = ?'
    ).get(towerId, i)
    if (!exists) {
      getDb().prepare(
        'INSERT INTO template_tower_slots (id, tower_id, slot_index) VALUES (?, ?, ?)'
      ).run(randomUUID(), towerId, i)
    }
  }
  getDb().prepare(
    'DELETE FROM template_tower_slots WHERE tower_id = ? AND slot_index > ?'
  ).run(towerId, slotCount)
}

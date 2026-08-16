import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'

export function listTemplates() {
  return getDb().prepare(`
    SELECT t.name, t.osc_host, t.updated_at,
           COUNT(tc.id) AS channel_count
    FROM templates t
    LEFT JOIN template_channels tc ON tc.template_id = t.id
    GROUP BY t.id
    ORDER BY t.name
  `).all().map(r => ({
    name: r.name,
    oscHost: r.osc_host ?? '',
    channelCount: r.channel_count,
    updatedAt: r.updated_at || null,
  }))
}

export function getTemplateByName(name) {
  return getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name) ?? null
}

export function updateTemplateOscHost(name, oscHost) {
  getDb().prepare('UPDATE templates SET osc_host = ? WHERE name = ?').run(oscHost, name)
}

export function renameTemplate(oldName, newName) {
  const tx = getDb().transaction(() => {
    getDb().prepare('UPDATE templates SET name = ? WHERE name = ?').run(newName, oldName)
    getDb().prepare('UPDATE shows SET template = ? WHERE template = ?').run(newName, oldName)
  })
  tx()
}

export function readTemplate(name) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(name)
  if (!tpl) return []
  return getDb().prepare('SELECT * FROM template_channels WHERE template_id = ? ORDER BY sort_order').all(tpl.id)
}

export function writeTemplate(name, channels) {
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
    getDb().prepare('DELETE FROM template_channels WHERE template_id = ?').run(tpl.id)
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]
      getDb().prepare(`
        INSERT INTO template_channels (id, template_id, channel, address, device, position, color, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(), tpl.id,
        ch.channel ?? '', ch.address ?? '', ch.device ?? '',
        ch.position ?? '', ch.color ?? '', ch.notes ?? '',
        i
      )
    }
  })
  tx()
}

export function deleteTemplate(name) {
  getDb().prepare('DELETE FROM templates WHERE name = ?').run(name)
}

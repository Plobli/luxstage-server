import { getDb } from '../db-context.js'
import { readShow, touchLastEdited } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readChannels(slug) {
  const show = readShow(slug)
  if (!show) return []
  return getDb().prepare('SELECT * FROM channels WHERE show_id = ? ORDER BY sort_order').all(show.id)
}

export function writeChannels(slug, channels, editedBy = null) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)

  const upsert = getDb().prepare(`
    INSERT INTO channels (id, show_id, channel, address, device, position, color, notes, mount_ref, quantity, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      channel = excluded.channel, address = excluded.address, device = excluded.device,
      position = excluded.position, color = excluded.color, notes = excluded.notes,
      mount_ref = excluded.mount_ref, quantity = excluded.quantity, sort_order = excluded.sort_order
  `)

  const tx = getDb().transaction(() => {
    // Bestehende Kanäle nach Kanalnummer indexieren, um IDs zu erhalten
    const existing = getDb().prepare('SELECT id, channel FROM channels WHERE show_id = ?').all(show.id)
    const idByNumber = new Map(existing.map(r => [r.channel, r.id]))
    const incomingIds = new Set()

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i]
      const id = idByNumber.get(ch.channel) ?? (ch.id || randomUUID())
      incomingIds.add(id)
      const mountRef = ch.mount_ref ? (typeof ch.mount_ref === 'string' ? ch.mount_ref : JSON.stringify(ch.mount_ref)) : null
      upsert.run(id, show.id, ch.channel ?? '', ch.address ?? '', ch.device ?? '', ch.position ?? '', ch.color ?? '', ch.notes ?? '', mountRef, ch.quantity ?? 1, i)
    }

    // Kanäle löschen, die nicht mehr in der Liste sind
    for (const { id } of existing) {
      if (!incomingIds.has(id)) {
        getDb().prepare('DELETE FROM channels WHERE id = ?').run(id)
      }
    }

    getDb().prepare('UPDATE shows SET updated_at = ?, channels_version = channels_version + 1 WHERE id = ?').run(now(), show.id)
    if (editedBy) touchLastEdited(show.id, editedBy)
  })
  tx()
}

/** Nur für die Konflikterkennung beim Channels-Save — getrennt von updated_at,
 *  das auch von Meta-Updates u.a. verändert wird. */
export function getChannelsVersion(slug) {
  const show = readShow(slug)
  return show ? String(show.channels_version) : null
}

export function getChecks(showSlug) {
  const CHECK_TTL_MS = 6 * 60 * 60 * 1000
  const cutoff = now() - CHECK_TTL_MS
  return getDb().prepare(
    'SELECT channel_id FROM lighting_checks WHERE show_id = ? AND checked_at >= ?'
  ).all(showSlug, cutoff).map(r => r.channel_id)
}

export function clearChecks(showSlug) {
  getDb().prepare('DELETE FROM lighting_checks WHERE show_id = ?').run(showSlug)
}

export function setCheck(showSlug, channelId, checked, username) {
  if (checked) {
    getDb().prepare(`
      INSERT INTO lighting_checks (show_id, channel_id, checked_by, checked_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(show_id, channel_id) DO UPDATE SET checked_by = excluded.checked_by, checked_at = excluded.checked_at
    `).run(showSlug, channelId, username, now())
  } else {
    getDb().prepare(
      'DELETE FROM lighting_checks WHERE show_id = ? AND channel_id = ?'
    ).run(showSlug, channelId)
  }
}

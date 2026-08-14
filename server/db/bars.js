import { getDb } from '../db-context.js'
import { readShow } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readBars(slug) {
  const show = readShow(slug)
  if (!show) return []
  const bars = getDb().prepare(
    'SELECT * FROM bars WHERE show_id = ? ORDER BY sort_order'
  ).all(show.id)
  for (const bar of bars) {
    bar.fixtures = getDb().prepare(
      'SELECT * FROM bar_fixtures WHERE bar_id = ? ORDER BY position'
    ).all(bar.id)
  }
  return bars
}

export function writeBar(slug, data) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const id = data.id || randomUUID()
  const existing = getDb().prepare('SELECT id, length_cm FROM bars WHERE id = ?').get(id)
  if (existing) {
    const currentSortOrder = getDb().prepare('SELECT sort_order FROM bars WHERE id = ?').get(id)?.sort_order ?? 0
    const currentBarType = getDb().prepare('SELECT bar_type FROM bars WHERE id = ?').get(id)?.bar_type ?? 'zugstange'
    const newLength = data.length_cm ?? 600
    getDb().prepare(`
      UPDATE bars SET name=?, zug_nr=?, length_cm=?, height_cm=?, notes=?, sort_order=?, hide_scale=?, bar_type=? WHERE id=?
    `).run(data.name ?? '', data.zug_nr ?? '', newLength, data.height_cm ?? null, data.notes ?? '', data.sort_order ?? currentSortOrder, data.hide_scale ? 1 : 0, data.bar_type ?? currentBarType, id)
    const oldLength = existing.length_cm
    if (oldLength && newLength && oldLength !== newLength) {
      const scale = newLength / oldLength
      getDb().prepare(
        'UPDATE bar_fixtures SET position = ROUND(position * ?, 1) WHERE bar_id = ?'
      ).run(scale, id)
    }
  } else {
    const maxOrder = getDb().prepare('SELECT MAX(sort_order) as m FROM bars WHERE show_id = ?').get(show.id).m
    const nextOrder = maxOrder == null ? 0 : maxOrder + 1
    getDb().prepare(`
      INSERT INTO bars (id, show_id, name, zug_nr, length_cm, height_cm, notes, sort_order, bar_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, show.id, data.name ?? '', data.zug_nr ?? '', data.length_cm ?? 600, data.height_cm ?? null, data.notes ?? '', data.sort_order ?? nextOrder, data.bar_type ?? 'zugstange', now())
  }
  return id
}

export function deleteBar(barId) {
  getDb().prepare('DELETE FROM bars WHERE id = ?').run(barId)
}

export function reorderBars(slug, orderedIds) {
  const show = readShow(slug)
  if (!show) return
  const update = getDb().prepare('UPDATE bars SET sort_order = ? WHERE id = ? AND show_id = ?')
  const tx = getDb().transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, show.id))
  })
  tx()
}

export function writeBarFixture(barId, channelId, position, notes, fixtureId) {
  const id = fixtureId || randomUUID()
  const existing = fixtureId ? getDb().prepare('SELECT id FROM bar_fixtures WHERE id = ?').get(id) : null
  if (existing) {
    getDb().prepare(
      'UPDATE bar_fixtures SET position = ?, notes = ? WHERE id = ?'
    ).run(position ?? 0, notes ?? '', id)
  } else {
    getDb().prepare(`
      INSERT INTO bar_fixtures (id, bar_id, channel_id, position, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, barId, channelId, position ?? 0, notes ?? '')
  }

  const bar = getDb().prepare('SELECT * FROM bars WHERE id = ?').get(barId)
  if (bar) {
    const mountRef = JSON.stringify({ type: 'bar', barId, barName: bar.name, zugNr: bar.zug_nr, barType: bar.bar_type, position: position ?? 0 })
    getDb().prepare('UPDATE channels SET mount_ref = ? WHERE id = ?').run(mountRef, channelId)
  }
  return id
}

export function updateBarFixtureNotes(fixtureId, notes) {
  getDb().prepare(
    'UPDATE bar_fixtures SET notes = ? WHERE id = ?'
  ).run(notes ?? '', fixtureId)
}

export function removeBarFixture(fixtureId) {
  const fx = getDb().prepare('SELECT channel_id FROM bar_fixtures WHERE id = ?').get(fixtureId)
  getDb().prepare('DELETE FROM bar_fixtures WHERE id = ?').run(fixtureId)
  if (fx?.channel_id) {
    getDb().prepare('UPDATE channels SET mount_ref = NULL WHERE id = ?').run(fx.channel_id)
  }
}

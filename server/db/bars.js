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
  // Auf show_id einschränken: sonst könnte eine fremde bar-ID (aus einer
  // anderen Show) hier aktualisiert werden — der Show-Lock in router.js
  // schützt nur die Show aus der URL, nicht beliebige IDs im Body.
  const existing = getDb().prepare('SELECT * FROM bars WHERE id = ? AND show_id = ?').get(id, show.id)
  if (existing) {
    const newLength = data.length_cm ?? 600
    getDb().prepare(`
      UPDATE bars SET name=?, zug_nr=?, length_cm=?, height_cm=?, notes=?, sort_order=?, hide_scale=?, bar_type=? WHERE id=?
    `).run(data.name ?? '', data.zug_nr ?? '', newLength, data.height_cm ?? null, data.notes ?? '', data.sort_order ?? existing.sort_order ?? 0, data.hide_scale ? 1 : 0, data.bar_type ?? existing.bar_type ?? 'zugstange', id)
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

export function deleteBar(showId, barId) {
  getDb().prepare('DELETE FROM bars WHERE id = ? AND show_id = ?').run(barId, showId)
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

export function writeBarFixture(showId, barId, channelId, { position = 0, notes = '', fixtureId = null, side = 'out', positionText = '' } = {}) {
  // Auf show_id einschränken: sonst ließe sich eine Fixture auf eine bar-ID
  // einer fremden Show anlegen/verschieben.
  const bar = getDb().prepare('SELECT * FROM bars WHERE id = ? AND show_id = ?').get(barId, showId)
  if (!bar) throw new Error(`Bar nicht in dieser Show: ${barId}`)

  const id = fixtureId || randomUUID()
  const existing = fixtureId ? getDb().prepare('SELECT bf.id FROM bar_fixtures bf WHERE bf.id = ? AND bf.bar_id = ?').get(id, barId) : null
  if (existing) {
    getDb().prepare(
      'UPDATE bar_fixtures SET position = ?, notes = ?, side = ?, position_text = ? WHERE id = ?'
    ).run(position ?? 0, notes ?? '', side ?? 'out', positionText ?? '', id)
  } else {
    getDb().prepare(`
      INSERT INTO bar_fixtures (id, bar_id, channel_id, position, notes, side, position_text)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, barId, channelId, position ?? 0, notes ?? '', side ?? 'out', positionText ?? '')
  }

  const mountRef = JSON.stringify({ type: 'bar', barId, barName: bar.name, zugNr: bar.zug_nr, barType: bar.bar_type, position: position ?? 0 })
  getDb().prepare('UPDATE channels SET mount_ref = ? WHERE id = ?').run(mountRef, channelId)
  return id
}

export function updateBarFixtureNotes(showId, fixtureId, notes) {
  getDb().prepare(`
    UPDATE bar_fixtures SET notes = ? WHERE id = ? AND bar_id IN (SELECT id FROM bars WHERE show_id = ?)
  `).run(notes ?? '', fixtureId, showId)
}

export function removeBarFixture(showId, fixtureId) {
  const fx = getDb().prepare(`
    SELECT bf.channel_id FROM bar_fixtures bf JOIN bars b ON b.id = bf.bar_id
    WHERE bf.id = ? AND b.show_id = ?
  `).get(fixtureId, showId)
  if (!fx) return
  getDb().prepare('DELETE FROM bar_fixtures WHERE id = ?').run(fixtureId)
  if (fx.channel_id) {
    getDb().prepare('UPDATE channels SET mount_ref = NULL WHERE id = ?').run(fx.channel_id)
  }
}

/** Ersetzt alle Bars + Fixtures einer Show durch den übergebenen Zustand —
 *  analog restoreTowers(), für Undo/Redo. channels.mount_ref wird dabei für
 *  den 'bar'-Typ neu aufgebaut (server ist alleiniger Schreiber, siehe
 *  writeBarFixture) statt wie zuvor auf dem letzten bekannten Stand zu bleiben. */
export function restoreBars(slug, bars) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const restoreAll = getDb().transaction(() => {
    getDb().prepare(`
      UPDATE channels SET mount_ref = NULL
      WHERE show_id = ? AND mount_ref IS NOT NULL AND json_extract(mount_ref, '$.type') = 'bar'
    `).run(show.id)
    getDb().prepare('DELETE FROM bars WHERE show_id = ?').run(show.id)
    for (const bar of bars) {
      getDb().prepare(`
        INSERT INTO bars (id, show_id, name, zug_nr, length_cm, height_cm, notes, sort_order, bar_type, hide_scale, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(bar.id, show.id, bar.name ?? '', bar.zug_nr ?? '', bar.length_cm ?? 600, bar.height_cm ?? null, bar.notes ?? '', bar.sort_order ?? 0, bar.bar_type ?? 'zugstange', bar.hide_scale ? 1 : 0, bar.created_at ?? Date.now())
      for (const fixture of (bar.fixtures ?? [])) {
        getDb().prepare(`
          INSERT INTO bar_fixtures (id, bar_id, channel_id, position, notes, side, position_text)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(fixture.id ?? randomUUID(), bar.id, fixture.channel_id, fixture.position ?? 0, fixture.notes ?? '', fixture.side ?? 'out', fixture.position_text ?? '')
        if (fixture.channel_id) {
          const mountRef = JSON.stringify({ type: 'bar', barId: bar.id, barName: bar.name ?? '', zugNr: bar.zug_nr ?? '', barType: bar.bar_type ?? 'zugstange', position: fixture.position ?? 0 })
          getDb().prepare('UPDATE channels SET mount_ref = ? WHERE id = ?').run(mountRef, fixture.channel_id)
        }
      }
    }
  })
  restoreAll()
}

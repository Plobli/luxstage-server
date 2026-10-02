import { getDb } from '../db-context.js'
import { readShow } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readBattens(slug) {
  const show = readShow(slug)
  if (!show) return []
  const battens = getDb().prepare(
    'SELECT * FROM battens WHERE show_id = ? ORDER BY sort_order'
  ).all(show.id)
  for (const batten of battens) {
    batten.fixtures = getDb().prepare(
      'SELECT * FROM batten_fixtures WHERE batten_id = ? ORDER BY position'
    ).all(batten.id)
  }
  return battens
}

export function writeBatten(slug, data) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const id = data.id || randomUUID()
  // Auf show_id einschränken: sonst könnte eine fremde batten-ID (aus einer
  // anderen Show) hier aktualisiert werden — der Show-Lock in router.js
  // schützt nur die Show aus der URL, nicht beliebige IDs im Body.
  const existing = getDb().prepare('SELECT * FROM battens WHERE id = ? AND show_id = ?').get(id, show.id)
  if (existing) {
    // length_cm vor Nutzung in der Fixture-Rescale-Arithmetik (scale =
    // newLength/oldLength) validieren: ein Wert wie 0 würde scale=0 ergeben
    // und still ALLE batten_fixtures.position dieser Batten auf 0 setzen, ein
    // nicht-numerischer String würde scale zu NaN machen. Ungültige Werte
    // fallen auf den bisherigen Wert zurück statt die Batten-Länge zu ändern.
    const requestedLength = data.length_cm
    const newLength = (Number.isFinite(requestedLength) && requestedLength > 0) ? requestedLength : (existing.length_cm ?? 600)
    getDb().prepare(`
      UPDATE battens SET name=?, batten_nr=?, length_cm=?, height_cm=?, notes=?, sort_order=?, hide_scale=?, batten_type=?, scale_origin=? WHERE id=?
    `).run(data.name ?? '', data.batten_nr ?? '', newLength, data.height_cm ?? null, data.notes ?? '', data.sort_order ?? existing.sort_order ?? 0, data.hide_scale ? 1 : 0, data.batten_type ?? existing.batten_type ?? 'batten', data.scale_origin ?? existing.scale_origin ?? 'center', id)
    const oldLength = existing.length_cm
    if (oldLength && newLength && oldLength !== newLength) {
      const scale = newLength / oldLength
      getDb().prepare(
        'UPDATE batten_fixtures SET position = ROUND(position * ?, 1) WHERE batten_id = ?'
      ).run(scale, id)
    }
  } else {
    const maxOrder = getDb().prepare('SELECT MAX(sort_order) as m FROM battens WHERE show_id = ?').get(show.id).m
    const nextOrder = maxOrder == null ? 0 : maxOrder + 1
    getDb().prepare(`
      INSERT INTO battens (id, show_id, name, batten_nr, length_cm, height_cm, notes, sort_order, batten_type, scale_origin, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, show.id, data.name ?? '', data.batten_nr ?? '', (Number.isFinite(data.length_cm) && data.length_cm > 0) ? data.length_cm : 600, data.height_cm ?? null, data.notes ?? '', data.sort_order ?? nextOrder, data.batten_type ?? 'batten', data.scale_origin ?? 'center', now())
  }
  return id
}

export function deleteBatten(showId, battenId) {
  getDb().prepare('DELETE FROM battens WHERE id = ? AND show_id = ?').run(battenId, showId)
}

export function deleteAllBattens(showId) {
  getDb().prepare('DELETE FROM battens WHERE show_id = ?').run(showId)
}

export function reorderBattens(slug, orderedIds) {
  const show = readShow(slug)
  if (!show) return
  const update = getDb().prepare('UPDATE battens SET sort_order = ? WHERE id = ? AND show_id = ?')
  const tx = getDb().transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id, show.id))
  })
  tx()
}

// channelId ist null bei generischen Elementen (kein Kanalbezug) — dann ist
// label Pflicht statt Kanalzuordnung. mount_ref auf channels wird nur bei
// vorhandener channelId gepflegt.
export function writeBattenFixture(showId, battenId, channelId, { position = 0, notes = '', fixtureId = null, side = 'out', positionText = '', label = '' } = {}) {
  // Auf show_id einschränken: sonst ließe sich eine Fixture auf eine batten-ID
  // einer fremden Show anlegen/verschieben.
  const batten = getDb().prepare('SELECT * FROM battens WHERE id = ? AND show_id = ?').get(battenId, showId)
  if (!batten) throw new Error(`Batten nicht in dieser Show: ${battenId}`)

  const id = fixtureId || randomUUID()
  const existing = fixtureId ? getDb().prepare('SELECT bf.id FROM batten_fixtures bf WHERE bf.id = ? AND bf.batten_id = ?').get(id, battenId) : null
  if (existing) {
    getDb().prepare(
      'UPDATE batten_fixtures SET position = ?, notes = ?, side = ?, position_text = ?, label = ? WHERE id = ?'
    ).run(position ?? 0, notes ?? '', side ?? 'out', positionText ?? '', label ?? '', id)
  } else {
    getDb().prepare(`
      INSERT INTO batten_fixtures (id, batten_id, channel_id, position, notes, side, position_text, label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, battenId, channelId ?? null, position ?? 0, notes ?? '', side ?? 'out', positionText ?? '', label ?? '')
  }

  if (channelId) {
    const mountRef = JSON.stringify({ type: 'batten', battenId, battenName: batten.name, battenNr: batten.batten_nr, battenType: batten.batten_type, position: position ?? 0 })
    getDb().prepare('UPDATE channels SET mount_ref = ? WHERE id = ?').run(mountRef, channelId)
  }
  return id
}

export function updateBattenFixtureNotes(showId, fixtureId, notes) {
  getDb().prepare(`
    UPDATE batten_fixtures SET notes = ? WHERE id = ? AND batten_id IN (SELECT id FROM battens WHERE show_id = ?)
  `).run(notes ?? '', fixtureId, showId)
}

export function removeBattenFixture(showId, fixtureId) {
  const fx = getDb().prepare(`
    SELECT bf.channel_id FROM batten_fixtures bf JOIN battens b ON b.id = bf.batten_id
    WHERE bf.id = ? AND b.show_id = ?
  `).get(fixtureId, showId)
  if (!fx) return
  getDb().prepare('DELETE FROM batten_fixtures WHERE id = ?').run(fixtureId)
  if (fx.channel_id) {
    getDb().prepare('UPDATE channels SET mount_ref = NULL WHERE id = ?').run(fx.channel_id)
  }
}

/** Ersetzt alle Battens + Fixtures einer Show durch den übergebenen Zustand —
 *  analog restoreTowers(), für Undo/Redo. channels.mount_ref wird dabei für
 *  den 'batten'-Typ neu aufgebaut (server ist alleiniger Schreiber, siehe
 *  writeBattenFixture) statt wie zuvor auf dem letzten bekannten Stand zu bleiben. */
export function restoreBattens(slug, battens) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const restoreAll = getDb().transaction(() => {
    getDb().prepare(`
      UPDATE channels SET mount_ref = NULL
      WHERE show_id = ? AND mount_ref IS NOT NULL AND json_extract(mount_ref, '$.type') = 'batten'
    `).run(show.id)
    getDb().prepare('DELETE FROM battens WHERE show_id = ?').run(show.id)
    for (const batten of battens) {
      getDb().prepare(`
        INSERT INTO battens (id, show_id, name, batten_nr, length_cm, height_cm, notes, sort_order, batten_type, hide_scale, scale_origin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(batten.id, show.id, batten.name ?? '', batten.batten_nr ?? '', batten.length_cm ?? 600, batten.height_cm ?? null, batten.notes ?? '', batten.sort_order ?? 0, batten.batten_type ?? 'batten', batten.hide_scale ? 1 : 0, batten.scale_origin ?? 'center', batten.created_at ?? Date.now())
      for (const fixture of (batten.fixtures ?? [])) {
        getDb().prepare(`
          INSERT INTO batten_fixtures (id, batten_id, channel_id, position, notes, side, position_text, label)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(fixture.id ?? randomUUID(), batten.id, fixture.channel_id ?? null, fixture.position ?? 0, fixture.notes ?? '', fixture.side ?? 'out', fixture.position_text ?? '', fixture.label ?? '')
        if (fixture.channel_id) {
          const mountRef = JSON.stringify({ type: 'batten', battenId: batten.id, battenName: batten.name ?? '', battenNr: batten.batten_nr ?? '', battenType: batten.batten_type ?? 'batten', position: fixture.position ?? 0 })
          getDb().prepare('UPDATE channels SET mount_ref = ? WHERE id = ?').run(mountRef, fixture.channel_id)
        }
      }
    }
  })
  restoreAll()
}

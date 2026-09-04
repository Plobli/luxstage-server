import { getDb } from '../db-context.js'
import { readShow } from './shows.js'
import { readTowersWithSlotsCore } from './tower-read-core.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readTowers(slug) {
  const show = readShow(slug)
  if (!show) return []
  return readTowersWithSlotsCore('towers', 'tower_slots', 'show_id', show.id)
}

export function writeTower(slug, data) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const id = data.id || randomUUID()
  // Auf show_id einschränken: sonst könnte eine fremde tower-ID (aus einer
  // anderen Show) hier aktualisiert werden.
  const current = getDb().prepare('SELECT * FROM towers WHERE id = ? AND show_id = ?').get(id, show.id)
  if (current) {
    getDb().prepare(`
      UPDATE towers SET name=?, side=?, stage_area=?, slot_count=?, sort_order=?, notes=? WHERE id=?
    `).run(
      data.name ?? current.name ?? '',
      data.side ?? current.side ?? '',
      data.stage_area ?? current.stage_area ?? '',
      data.slot_count ?? current.slot_count ?? 4,
      data.sort_order ?? current.sort_order ?? 0,
      data.notes ?? current.notes ?? '',
      id
    )
  } else {
    const count = getDb().prepare('SELECT COUNT(*) as n FROM towers WHERE show_id = ?').get(show.id).n
    getDb().prepare(`
      INSERT INTO towers (id, show_id, name, side, stage_area, slot_count, sort_order, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, show.id, data.name ?? '', data.side ?? '', data.stage_area ?? '', data.slot_count ?? 4, data.sort_order ?? count, data.notes ?? '', now())
  }
  return id
}

export function deleteTower(showId, towerId) {
  getDb().prepare('DELETE FROM towers WHERE id = ? AND show_id = ?').run(towerId, showId)
}

// Auf show_id einschränken: sonst ließe sich ein Slot einer fremden tower-ID
// (aus einer anderen Show) hier beschreiben.
//
// mount_ref: der Server ist alleiniger Schreiber (analog writeBarFixture in
// db/bars.js) — der Client behandelt ihn nur noch lesend. Vorher wurde er für
// Türme ausschließlich clientseitig im Speicher gepflegt und nie persistiert;
// nach einem Neuladen war der Rückverweis vom Kanal zum Turm verloren.
export function writeTowerSlot(showId, towerId, slotIndex, channelId) {
  const tower = getDb().prepare('SELECT * FROM towers WHERE id = ? AND show_id = ?').get(towerId, showId)
  if (!tower) throw new Error(`Turm nicht in dieser Show: ${towerId}`)

  const previous = getDb().prepare('SELECT channel_id FROM tower_slots WHERE tower_id = ? AND slot_index = ?').get(towerId, slotIndex)
  if (previous?.channel_id && previous.channel_id !== channelId) {
    getDb().prepare('UPDATE channels SET mount_ref = NULL WHERE id = ?').run(previous.channel_id)
  }

  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO tower_slots (id, tower_id, slot_index, channel_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(tower_id, slot_index) DO UPDATE SET channel_id = excluded.channel_id
  `).run(id, towerId, slotIndex, channelId || null)

  if (channelId) {
    const mountRef = JSON.stringify({ type: 'tower', towerId, towerName: tower.name, slotIndex })
    getDb().prepare('UPDATE channels SET mount_ref = ? WHERE id = ?').run(mountRef, channelId)
  }
}

export function clearTowerSlot(showId, towerId, slotIndex) {
  const slot = getDb().prepare(`
    SELECT channel_id FROM tower_slots
    WHERE tower_id = ? AND slot_index = ? AND tower_id IN (SELECT id FROM towers WHERE show_id = ?)
  `).get(towerId, slotIndex, showId)
  if (!slot) return
  getDb().prepare('UPDATE tower_slots SET channel_id = NULL WHERE tower_id = ? AND slot_index = ?').run(towerId, slotIndex)
  if (slot.channel_id) {
    getDb().prepare('UPDATE channels SET mount_ref = NULL WHERE id = ?').run(slot.channel_id)
  }
}

export function restoreTowers(slug, towers) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const restoreAll = getDb().transaction(() => {
    // mount_ref alter Zuordnungen räumen, bevor die Türme neu aufgebaut werden
    // — sonst blieben Kanäle, die in diesem Show-Zustand keinem Turm-Slot
    // mehr zugeordnet sind, fälschlich auf ihren alten mount_ref sitzen.
    getDb().prepare(`
      UPDATE channels SET mount_ref = NULL
      WHERE show_id = ? AND mount_ref IS NOT NULL AND json_extract(mount_ref, '$.type') = 'tower'
    `).run(show.id)
    getDb().prepare('DELETE FROM towers WHERE show_id = ?').run(show.id)
    for (const tower of towers) {
      getDb().prepare(`
        INSERT INTO towers (id, show_id, name, side, stage_area, slot_count, sort_order, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tower.id, show.id, tower.name ?? '', tower.side ?? '', tower.stage_area ?? '', tower.slot_count ?? 4, tower.sort_order ?? 0, tower.notes ?? '', tower.created_at ?? Date.now())
      for (const slot of (tower.slots ?? [])) {
        getDb().prepare(`
          INSERT INTO tower_slots (id, tower_id, slot_index, channel_id)
          VALUES (?, ?, ?, ?)
        `).run(slot.id ?? randomUUID(), tower.id, slot.slot_index, slot.channel_id ?? null)
        if (slot.channel_id) {
          const mountRef = JSON.stringify({ type: 'tower', towerId: tower.id, towerName: tower.name ?? '', slotIndex: slot.slot_index })
          getDb().prepare('UPDATE channels SET mount_ref = ? WHERE id = ?').run(mountRef, slot.channel_id)
        }
      }
    }
  })
  restoreAll()
}

export function ensureTowerSlots(towerId, slotCount) {
  for (let i = 1; i <= slotCount; i++) {
    const exists = getDb().prepare(
      'SELECT id FROM tower_slots WHERE tower_id = ? AND slot_index = ?'
    ).get(towerId, i)
    if (!exists) {
      getDb().prepare(
        'INSERT INTO tower_slots (id, tower_id, slot_index, channel_id) VALUES (?, ?, ?, NULL)'
      ).run(randomUUID(), towerId, i)
    }
  }
  getDb().prepare(
    'DELETE FROM tower_slots WHERE tower_id = ? AND slot_index > ?'
  ).run(towerId, slotCount)
}

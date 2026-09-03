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
  const existing = getDb().prepare('SELECT id FROM towers WHERE id = ?').get(id)
  if (existing) {
    const current = getDb().prepare('SELECT * FROM towers WHERE id = ?').get(id)
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

export function deleteTower(towerId) {
  getDb().prepare('DELETE FROM towers WHERE id = ?').run(towerId)
}

export function writeTowerSlot(towerId, slotIndex, channelId) {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO tower_slots (id, tower_id, slot_index, channel_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(tower_id, slot_index) DO UPDATE SET channel_id = excluded.channel_id
  `).run(id, towerId, slotIndex, channelId || null)
}

export function clearTowerSlot(towerId, slotIndex) {
  getDb().prepare(
    'UPDATE tower_slots SET channel_id = NULL WHERE tower_id = ? AND slot_index = ?'
  ).run(towerId, slotIndex)
}

export function restoreTowers(slug, towers) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const restoreAll = getDb().transaction(() => {
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

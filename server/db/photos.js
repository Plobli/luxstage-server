import { getDb } from '../db-context.js'
import { readShow } from './shows.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function readPhotoDescriptions(slug) {
  const show = readShow(slug)
  if (!show) return {}
  const rows = getDb().prepare('SELECT filename, caption FROM photo_descriptions WHERE show_id = ?').all(show.id)
  return Object.fromEntries(rows.map(r => [r.filename, { caption: r.caption }]))
}

export function writePhotoDescription(slug, filename, caption) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  getDb().prepare(`
    INSERT INTO photo_descriptions (show_id, filename, caption)
    VALUES (?, ?, ?)
    ON CONFLICT(show_id, filename) DO UPDATE SET
      caption = excluded.caption
  `).run(show.id, filename, caption)
}

export function deletePhotoDescription(slug, filename) {
  const show = readShow(slug)
  if (!show) return
  getDb().prepare('DELETE FROM photo_descriptions WHERE show_id = ? AND filename = ?').run(show.id, filename)
}

export function readPhotoOrder(slug) {
  const show = readShow(slug)
  if (!show) return []
  return getDb().prepare('SELECT filename FROM photo_order WHERE show_id = ? ORDER BY sort_order')
    .all(show.id)
    .map(r => r.filename)
}

export function writePhotoOrder(slug, order) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const insertOrder = getDb().prepare('INSERT INTO photo_order (show_id, filename, sort_order) VALUES (?, ?, ?)')
  const tx = getDb().transaction(() => {
    getDb().prepare('DELETE FROM photo_order WHERE show_id = ?').run(show.id)
    for (let i = 0; i < order.length; i++) insertOrder.run(show.id, order[i], i)
    getDb().prepare('UPDATE shows SET updated_at = ? WHERE id = ?').run(now(), show.id)
  })
  tx()
}

export function deletePhotoOrderEntry(slug, filename) {
  const show = readShow(slug)
  if (!show) return
  getDb().prepare('DELETE FROM photo_order WHERE show_id = ? AND filename = ?').run(show.id, filename)
}

// Alle vier Funktionen auf show_id einschränken: sonst ließe sich über eine
// fremde channelId (aus einer anderen Show) deren Foto-Zuordnung lesen/ändern.
export function readChannelPhotos(showId, channelId) {
  return getDb().prepare(`
    SELECT cp.filename FROM channel_photos cp
    JOIN channels c ON c.id = cp.channel_id
    WHERE cp.channel_id = ? AND c.show_id = ?
    ORDER BY cp.sort_order
  `).all(channelId, showId).map(r => r.filename)
}

export function addChannelPhoto(showId, channelId, filename) {
  getDb().prepare(`
    INSERT OR IGNORE INTO channel_photos (id, channel_id, filename, sort_order)
    SELECT ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM channel_photos WHERE channel_id = ?)
    WHERE EXISTS (SELECT 1 FROM channels WHERE id = ? AND show_id = ?)
  `).run(randomUUID(), channelId, filename, channelId, channelId, showId)
}

export function removeChannelPhoto(showId, channelId, filename) {
  getDb().prepare(`
    DELETE FROM channel_photos
    WHERE channel_id = ? AND filename = ? AND channel_id IN (SELECT id FROM channels WHERE show_id = ?)
  `).run(channelId, filename, showId)
}

export function reorderChannelPhotos(showId, channelId, filenames) {
  const updateOrder = getDb().prepare(`
    UPDATE channel_photos SET sort_order = ?
    WHERE channel_id = ? AND filename = ? AND channel_id IN (SELECT id FROM channels WHERE show_id = ?)
  `)
  const tx = getDb().transaction(() => {
    for (let i = 0; i < filenames.length; i++) updateOrder.run(i, channelId, filenames[i], showId)
  })
  tx()
}

export function readAllPhotoChannels(slug) {
  const show = readShow(slug)
  if (!show) return {}
  const rows = getDb().prepare(`
    SELECT cp.filename, cp.channel_id AS id FROM channel_photos cp
    JOIN channels c ON c.id = cp.channel_id
    WHERE c.show_id = ?
    ORDER BY cp.filename, cp.sort_order
  `).all(show.id)
  const map = {}
  for (const r of rows) (map[r.filename] ??= []).push(r.id)
  return map
}

export function deletePhotoChannels(slug, filename) {
  const show = readShow(slug)
  if (!show) return
  getDb().prepare(`
    DELETE FROM channel_photos
    WHERE filename = ? AND channel_id IN (SELECT id FROM channels WHERE show_id = ?)
  `).run(filename, show.id)
}

export function setPhotoChannels(slug, filename, channelIds) {
  const show = readShow(slug)
  if (!show) throw new Error(`Show not found: ${slug}`)
  const tx = getDb().transaction(() => {
    getDb().prepare(`
      DELETE FROM channel_photos
      WHERE filename = ? AND channel_id IN (SELECT id FROM channels WHERE show_id = ?)
    `).run(filename, show.id)
    const insert = getDb().prepare(`
      INSERT OR IGNORE INTO channel_photos (id, channel_id, filename, sort_order)
      SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM channels WHERE id = ? AND show_id = ?)
    `)
    for (let i = 0; i < channelIds.length; i++) insert.run(randomUUID(), channelIds[i], filename, i, channelIds[i], show.id)
  })
  tx()
}

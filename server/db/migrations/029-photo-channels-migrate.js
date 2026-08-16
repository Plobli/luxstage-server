// channel_photos: Index auf filename für Rückwärtsabfrage (Foto -> Kanäle),
// plus Migration der alten Freitext-Kreisnummer aus photo_descriptions.channel_number
import { randomUUID } from 'node:crypto'

export const id = '029-photo-channels-migrate'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_channel_photos_filename'").get()
}

export function up(db) {
  db.exec('CREATE INDEX idx_channel_photos_filename ON channel_photos(filename)')

  const hasChannelNumber = db.pragma('table_info(photo_descriptions)').some(c => c.name === 'channel_number')
  if (!hasChannelNumber) return

  const rows = db.prepare(`
    SELECT pd.show_id, pd.filename, pd.channel_number
    FROM photo_descriptions pd
    WHERE pd.channel_number IS NOT NULL AND TRIM(pd.channel_number) != ''
  `).all()

  const findChannel = db.prepare('SELECT id FROM channels WHERE show_id = ? AND TRIM(channel) = TRIM(?)')
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO channel_photos (id, channel_id, filename, sort_order)
    VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM channel_photos WHERE channel_id = ?))
  `)

  const tx = db.transaction(() => {
    for (const row of rows) {
      const channel = findChannel.get(row.show_id, row.channel_number)
      if (!channel) continue
      insertLink.run(randomUUID(), channel.id, row.filename, channel.id)
    }
    db.exec('ALTER TABLE photo_descriptions DROP COLUMN channel_number')
  })
  tx()
}

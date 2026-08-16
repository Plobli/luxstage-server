// channel_photos: Mehrere Fotos pro Kanal zuordnen
export const id = '007-channel-photos'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='channel_photos'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE channel_photos (
      id         TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(channel_id, filename)
    );
    CREATE INDEX idx_channel_photos_channel ON channel_photos(channel_id);
  `)
}

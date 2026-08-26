// LuxStage/server/db-init.js
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { migrations } from './db/migrations/index.js'

export const dbContainer = { db: null }

// Datenverzeichnis sicherstellen — bei frischem Deploy/Volume existiert es sonst nicht.
fs.mkdirSync(config.dataPath, { recursive: true })

const dbPath = path.join(config.dataPath, 'luxstage.db')
dbContainer.db = new Database(dbPath)

// Basis-Schema. Nur CREATE TABLE IF NOT EXISTS — idempotent.
function _initSchema(database) {
  database.pragma('journal_mode = WAL')
  database.pragma('synchronous = NORMAL')
  database.pragma('busy_timeout = 5000')
  database.pragma('foreign_keys = ON')

  database.exec(`
    CREATE TABLE IF NOT EXISTS shows (
      id             TEXT PRIMARY KEY,
      slug           TEXT UNIQUE NOT NULL,
      name           TEXT,
      datum          TEXT,
      template       TEXT,
      spielzeit      TEXT,
      setup_markdown TEXT,
      eos_active_channels TEXT,
      archived       INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shows_archived ON shows(archived);

    CREATE TABLE IF NOT EXISTS channels (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      channel    TEXT,
      address    TEXT,
      device     TEXT,
      position   TEXT,
      color      TEXT,
      notes      TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_channels_show ON channels(show_id);

    -- icon: stabiler Bezeichner für das Sidebar-Symbol ('warning', 'room', '').
    -- Bewusst getrennt von type: type ist die Darstellungsart (markdown/kv-table),
    -- icon die Bedeutung. Vorher hing das Symbol am deutschen Titel-Literal und
    -- verschwand beim Umbenennen oder Sprachwechsel.
    CREATE TABLE IF NOT EXISTS section_defs (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      title      TEXT,
      type       TEXT,
      icon       TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_section_defs_show ON section_defs(show_id);

    CREATE TABLE IF NOT EXISTS section_fields (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      label      TEXT,
      unit       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_section_fields_section ON section_fields(section_id);

    CREATE TABLE IF NOT EXISTS section_contents (
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      content    TEXT,
      PRIMARY KEY (section_id, show_id)
    );

    CREATE INDEX IF NOT EXISTS idx_section_contents_show ON section_contents(show_id);

    CREATE TABLE IF NOT EXISTS templates (
      id   TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS template_channels (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      channel     TEXT,
      address     TEXT,
      device      TEXT,
      position    TEXT,
      color       TEXT,
      notes       TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS template_section_defs (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      title       TEXT,
      type        TEXT,
      icon        TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS template_section_fields (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES template_section_defs(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      label      TEXT,
      unit       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS photo_descriptions (
      show_id        TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      filename       TEXT NOT NULL,
      caption        TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (show_id, filename)
    );

    CREATE TABLE IF NOT EXISTS photo_order (
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (show_id, filename)
    );

    CREATE TABLE IF NOT EXISTS locks (
      show_id  TEXT PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      since    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      channels   TEXT NOT NULL,
      sections   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS template_floorplans (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      image_path  TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS show_floorplan_layers (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      canvas_data TEXT,
      image_path TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      username                  TEXT PRIMARY KEY,
      password                  TEXT NOT NULL,
      requires_password_change  INTEGER NOT NULL DEFAULT 0,
      email                     TEXT NOT NULL DEFAULT '',
      pending                   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token      TEXT PRIMARY KEY,
      username   TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `)
}

function _ensureMigrationsTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)
}

// Führt jede Migration aus db/migrations/ genau einmal aus, getrackt in
// schema_migrations. Für DBs, die vor Einführung dieser Tabelle entstanden,
// erkennt alreadyApplied() bereits vorhandenes Schema und markiert die
// Migration als erledigt, statt sie erneut auszuführen.
function _runMigrations(database) {
  _ensureMigrationsTable(database)
  const isApplied = database.prepare('SELECT 1 FROM schema_migrations WHERE id = ?')
  const markApplied = database.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')

  for (const migration of migrations) {
    if (isApplied.get(migration.id)) continue

    if (migration.alreadyApplied(database)) {
      markApplied.run(migration.id, Date.now())
      continue
    }

    database.transaction(() => {
      migration.up(database)
      markApplied.run(migration.id, Date.now())
    })()
  }
}

// Vollständige Initialisierung einer DB: Basis-Schema + alle Migrationen.
// Idempotent — sicher für neue wie bestehende DBs. Pro Mandanten-DB aufrufbar.
export function initSchema(database) {
  _initSchema(database)
  _runMigrations(database)
  return database
}

initSchema(dbContainer.db)

export function resetDb() {
  if (dbContainer.db) dbContainer.db.close()
  dbContainer.db = new Database(':memory:')
  initSchema(dbContainer.db)
}

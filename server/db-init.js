// LuxStage/server/db-init.js
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

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
      channel_number TEXT NOT NULL DEFAULT '',
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
      role                      TEXT NOT NULL DEFAULT 'techniker',
      requires_password_change  INTEGER NOT NULL DEFAULT 0,
      email                     TEXT NOT NULL DEFAULT ''
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

// Nachträgliche Migrationen. Alle idempotent (Spalten-/Tabellen-Checks, settings-Flags).
function _runMigrations(database) {
// lighting_checks: Einleucht-Status pro Show (TTL 6h, kein FK-Constraint damit alte Shows sauber bleiben)
const lightingChecksExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='lighting_checks'"
).get()
if (!lightingChecksExists) {
  database.exec(`
    CREATE TABLE lighting_checks (
      show_id    TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      checked_by TEXT NOT NULL,
      checked_at INTEGER NOT NULL,
      PRIMARY KEY (show_id, channel_id)
    );
    CREATE INDEX idx_lighting_checks_show ON lighting_checks(show_id);
  `)
}

// sidebar_pinned: User-Preference, nachträglich hinzugefügt
const userCols = database.pragma('table_info(users)').map(c => c.name)
if (!userCols.includes('sidebar_pinned')) {
  database.exec('ALTER TABLE users ADD COLUMN sidebar_pinned INTEGER NOT NULL DEFAULT 0')
}
if (!userCols.includes('griddeck_config')) {
  database.exec('ALTER TABLE users ADD COLUMN griddeck_config TEXT')
}

// last_edited_by/at: nachträglich hinzugefügt, fehlt in älteren DBs
const showCols = database.pragma('table_info(shows)').map(c => c.name)
if (!showCols.includes('last_edited_by')) {
  database.exec('ALTER TABLE shows ADD COLUMN last_edited_by TEXT')
}
if (!showCols.includes('last_edited_at')) {
  database.exec('ALTER TABLE shows ADD COLUMN last_edited_at INTEGER')
}
if (!showCols.includes('use_bars')) {
  database.exec('ALTER TABLE shows ADD COLUMN use_bars INTEGER NOT NULL DEFAULT 1')
}
if (!showCols.includes('use_towers')) {
  database.exec('ALTER TABLE shows ADD COLUMN use_towers INTEGER NOT NULL DEFAULT 1')
}
if (!showCols.includes('eos_excluded_channels')) {
  database.exec('ALTER TABLE shows ADD COLUMN eos_excluded_channels TEXT')
}
// channels_version: eigener Versionszähler nur für Channel-Writes, getrennt
// von updated_at (das auch von Meta-Updates, Archivieren etc. verändert
// wird und deshalb für Channels-Konflikterkennung ungeeignet ist).
if (!showCols.includes('channels_version')) {
  database.exec('ALTER TABLE shows ADD COLUMN channels_version INTEGER NOT NULL DEFAULT 0')
}
// section_contents_version / section_defs_version: gleiches Prinzip wie
// channels_version, für die beiden unabhängigen Sections-PUT-Endpunkte
// (Inhalte vs. Struktur/Definitionen).
if (!showCols.includes('section_contents_version')) {
  database.exec('ALTER TABLE shows ADD COLUMN section_contents_version INTEGER NOT NULL DEFAULT 0')
}
if (!showCols.includes('section_defs_version')) {
  database.exec('ALTER TABLE shows ADD COLUMN section_defs_version INTEGER NOT NULL DEFAULT 0')
}
if (showCols.includes('untertitel')) {
  database.exec('ALTER TABLE shows DROP COLUMN untertitel')
}
// section_kv_rows: Zeilen für kv-table Sections
const kvRowsTableExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='section_kv_rows'"
).get()
if (!kvRowsTableExists) {
  database.exec(`
    CREATE TABLE section_kv_rows (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      label      TEXT NOT NULL DEFAULT '',
      value      TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_section_kv_rows_section ON section_kv_rows(section_id);
  `)
}

// template_section_kv_rows: wie section_kv_rows, aber für Templates
const tplKvRowsTableExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_section_kv_rows'"
).get()
if (!tplKvRowsTableExists) {
  database.exec(`
    CREATE TABLE template_section_kv_rows (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES template_section_defs(id) ON DELETE CASCADE,
      label      TEXT NOT NULL DEFAULT '',
      value      TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_tpl_section_kv_rows_section ON template_section_kv_rows(section_id);
  `)
}

const templateCols = database.pragma('table_info(templates)').map(c => c.name)
if (!templateCols.includes('osc_host')) {
  database.exec("ALTER TABLE templates ADD COLUMN osc_host TEXT NOT NULL DEFAULT ''")
}
if (!templateCols.includes('updated_at')) {
  database.exec('ALTER TABLE templates ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0')
}

// channel_photos: Mehrere Fotos pro Kanal zuordnen
const channelPhotosExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='channel_photos'"
).get()
if (!channelPhotosExists) {
  database.exec(`
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

// template_floorplans: canvas_data nachträglich hinzugefügt
const tplFloorplanCols = database.prepare("PRAGMA table_info(template_floorplans)").all().map(c => c.name)
if (!tplFloorplanCols.includes('canvas_data')) {
  database.exec('ALTER TABLE template_floorplans ADD COLUMN canvas_data TEXT')
}

// show_floorplan_layers: image_path + canvas_data nachträglich hinzugefügt
{
  const showFloorplanCols = database.pragma('table_info(show_floorplan_layers)').map(c => c.name)
  if (!showFloorplanCols.includes('image_path')) {
    database.exec('ALTER TABLE show_floorplan_layers ADD COLUMN image_path TEXT')
  }
  if (!showFloorplanCols.includes('canvas_data')) {
    database.exec(`
      CREATE TABLE show_floorplan_layers_new (
        id         TEXT PRIMARY KEY,
        show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        canvas_data TEXT,
        image_path TEXT,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO show_floorplan_layers_new (id, show_id, image_path, updated_at)
        SELECT id, show_id, image_path, updated_at FROM show_floorplan_layers;
      DROP TABLE show_floorplan_layers;
      ALTER TABLE show_floorplan_layers_new RENAME TO show_floorplan_layers;
    `)
  }
}

// towers: Gassenturm-Instanzen pro Show
const towersTableExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='towers'"
).get()
if (!towersTableExists) {
  database.exec(`
    CREATE TABLE towers (
      id           TEXT PRIMARY KEY,
      show_id      TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      name         TEXT NOT NULL DEFAULT '',
      side         TEXT NOT NULL DEFAULT '',
      stage_area   TEXT NOT NULL DEFAULT '',
      slot_count   INTEGER NOT NULL DEFAULT 4,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX idx_towers_show ON towers(show_id);

    CREATE TABLE tower_slots (
      id         TEXT PRIMARY KEY,
      tower_id   TEXT NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL,
      channel_id TEXT,
      UNIQUE(tower_id, slot_index)
    );
    CREATE INDEX idx_tower_slots_tower ON tower_slots(tower_id);
  `)
}

// mount_ref in channels: JSON-Feld { type, towerId, slotIndex } oder null
const channelCols = database.pragma('table_info(channels)').map(c => c.name)
if (!channelCols.includes('mount_ref')) {
  database.exec("ALTER TABLE channels ADD COLUMN mount_ref TEXT")
}
if (!channelCols.includes('quantity')) {
  database.exec("ALTER TABLE channels ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1")
}

// bars: Zugstangen pro Show
const barsTableExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='bars'"
).get()
if (!barsTableExists) {
  database.exec(`
    CREATE TABLE bars (
      id           TEXT PRIMARY KEY,
      show_id      TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      name         TEXT NOT NULL DEFAULT '',
      zug_nr       TEXT NOT NULL DEFAULT '',
      length_cm    INTEGER NOT NULL DEFAULT 600,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX idx_bars_show ON bars(show_id);

    CREATE TABLE bar_fixtures (
      id         TEXT PRIMARY KEY,
      bar_id     TEXT NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
      channel_id TEXT,
      position   REAL NOT NULL DEFAULT 0,
      UNIQUE(bar_id, channel_id)
    );
    CREATE INDEX idx_bar_fixtures_bar ON bar_fixtures(bar_id);
  `)
}

// Migration: height_cm + notes auf bars
{
  const cols = database.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  if (!cols.includes('height_cm'))
    database.exec("ALTER TABLE bars ADD COLUMN height_cm REAL")
  if (!cols.includes('notes'))
    database.exec("ALTER TABLE bars ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

// Migration: hide_scale auf bars
{
  const cols = database.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  if (!cols.includes('hide_scale'))
    database.exec("ALTER TABLE bars ADD COLUMN hide_scale INTEGER NOT NULL DEFAULT 0")
}

// Migration: notes auf bar_fixtures
{
  const cols = database.prepare("PRAGMA table_info(bar_fixtures)").all().map(c => c.name)
  if (!cols.includes('notes'))
    database.exec("ALTER TABLE bar_fixtures ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

// Migration: UNIQUE(bar_id, channel_id) entfernen → mehrfache Kanäle auf einer Stange erlauben
{
  const done = database.prepare(
    "SELECT value FROM settings WHERE key = 'migration_bar_fixtures_no_unique_2026'"
  ).get()
  if (!done) {
    database.exec(`
      CREATE TABLE bar_fixtures_new (
        id         TEXT PRIMARY KEY,
        bar_id     TEXT NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
        channel_id TEXT,
        position   REAL NOT NULL DEFAULT 0,
        notes      TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO bar_fixtures_new (id, bar_id, channel_id, position, notes)
        SELECT id, bar_id, channel_id, position, notes FROM bar_fixtures;
      DROP TABLE bar_fixtures;
      ALTER TABLE bar_fixtures_new RENAME TO bar_fixtures;
      CREATE INDEX IF NOT EXISTS idx_bar_fixtures_bar ON bar_fixtures(bar_id);
      INSERT INTO settings (key, value) VALUES ('migration_bar_fixtures_no_unique_2026', '1');
    `)
  }
}

// Migration: notes auf towers
{
  const cols = database.prepare("PRAGMA table_info(towers)").all().map(c => c.name)
  if (!cols.includes('notes'))
    database.exec("ALTER TABLE towers ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

// Migration: bar_type auf bars — unterscheidet Zugstange/Traverse/Punktzug
{
  const cols = database.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  if (!cols.includes('bar_type'))
    database.exec("ALTER TABLE bars ADD COLUMN bar_type TEXT NOT NULL DEFAULT 'zugstange'")
}

// Migration: side auf bar_fixtures — innen/außen bei Traversen
{
  const cols = database.prepare("PRAGMA table_info(bar_fixtures)").all().map(c => c.name)
  if (!cols.includes('side'))
    database.exec("ALTER TABLE bar_fixtures ADD COLUMN side TEXT NOT NULL DEFAULT 'out'")
}

// Migration: position_text auf bar_fixtures — Freitext-Position bei Punktzug
{
  const cols = database.prepare("PRAGMA table_info(bar_fixtures)").all().map(c => c.name)
  if (!cols.includes('position_text'))
    database.exec("ALTER TABLE bar_fixtures ADD COLUMN position_text TEXT NOT NULL DEFAULT ''")
}

// template_bars: Zugstangen-Definitionen pro Bühnen-Template
const templateBarsTableExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_bars'"
).get()
if (!templateBarsTableExists) {
  database.exec(`
    CREATE TABLE template_bars (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT '',
      zug_nr      TEXT NOT NULL DEFAULT '',
      length_cm   INTEGER NOT NULL DEFAULT 600,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      bar_type    TEXT NOT NULL DEFAULT 'zugstange'
    );
    CREATE INDEX idx_template_bars_tpl ON template_bars(template_id);
  `)
}

// Migration: bar_type auf template_bars
{
  const cols = database.prepare("PRAGMA table_info(template_bars)").all().map(c => c.name)
  if (!cols.includes('bar_type'))
    database.exec("ALTER TABLE template_bars ADD COLUMN bar_type TEXT NOT NULL DEFAULT 'zugstange'")
}

// Migration: section_defs Umbenennung (Stände→Raum, Besonderheiten→Hinweise)
{
  const done = database.prepare(
    "SELECT value FROM settings WHERE key = 'migration_section_rename_2026'"
  ).get()
  if (!done) {
    database.exec(`
      UPDATE section_defs SET title = 'Raum'     WHERE title = 'Stände';
      UPDATE section_defs SET title = 'Hinweise' WHERE title = 'Besonderheiten';
      UPDATE template_section_defs SET title = 'Raum'     WHERE title = 'Stände';
      UPDATE template_section_defs SET title = 'Hinweise' WHERE title = 'Besonderheiten';
      INSERT INTO settings (key, value) VALUES ('migration_section_rename_2026', '1');
    `)
  }
}

// icon: stabiler Bezeichner für das Sidebar-Symbol. Vorher wurde es aus dem
// deutschen Titel abgeleitet — beim Umbenennen oder auf Englisch war es weg.
// Muss nach der Titel-Umbenennung oben laufen, weil aus den Titeln abgeleitet wird.
for (const table of ['section_defs', 'template_section_defs']) {
  const cols = database.pragma(`table_info(${table})`).map(c => c.name)
  if (!cols.includes('icon')) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN icon TEXT NOT NULL DEFAULT ''`)
    // Einmalige Zuordnung nach dem heutigen Stand. Danach bleibt icon stabil,
    // auch wenn der Nutzer den Abschnitt umbenennt.
    // 'setup' ist mehr als ein Symbol: daran hängt auch der generierte Text
    // (Beleuchtungsgestelle/Obermaschinerie) und die Erkennung, ob der
    // Aufbau-Abschnitt schon existiert.
    database.exec(`
      UPDATE ${table} SET icon = 'warning' WHERE title = 'Hinweise';
      UPDATE ${table} SET icon = 'room'    WHERE title = 'Raum';
      UPDATE ${table} SET icon = 'setup'   WHERE title = 'Aufbau';
    `)
  }
}

// template_towers: Gassenturm-Definitionen pro Bühnen-Template
const templateTowersTableExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_towers'"
).get()
if (!templateTowersTableExists) {
  database.exec(`
    CREATE TABLE template_towers (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT '',
      side        TEXT NOT NULL DEFAULT '',
      stage_area  TEXT NOT NULL DEFAULT '',
      slot_count  INTEGER NOT NULL DEFAULT 4,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_template_towers_tpl ON template_towers(template_id);

    CREATE TABLE template_tower_slots (
      id         TEXT PRIMARY KEY,
      tower_id   TEXT NOT NULL REFERENCES template_towers(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL,
      channel    TEXT,
      device     TEXT,
      color      TEXT,
      UNIQUE(tower_id, slot_index)
    );
    CREATE INDEX idx_template_tower_slots_tower ON template_tower_slots(tower_id);
  `)
}

// template_bar_fixtures: Scheinwerfer-Positionen auf Template-Bars
const templateBarFixturesTableExists = database.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='template_bar_fixtures'"
).get()
if (!templateBarFixturesTableExists) {
  database.exec(`
    CREATE TABLE template_bar_fixtures (
      id         TEXT PRIMARY KEY,
      bar_id     TEXT NOT NULL REFERENCES template_bars(id) ON DELETE CASCADE,
      position   REAL NOT NULL DEFAULT 0,
      channel    TEXT,
      device     TEXT,
      color      TEXT,
      notes      TEXT NOT NULL DEFAULT '',
      UNIQUE(bar_id, position)
    );
    CREATE INDEX idx_template_bar_fixtures_bar ON template_bar_fixtures(bar_id);
  `)
}

// Migration: side auf template_bar_fixtures — innen/außen bei Traversen
{
  const cols = database.prepare("PRAGMA table_info(template_bar_fixtures)").all().map(c => c.name)
  if (!cols.includes('side'))
    database.exec("ALTER TABLE template_bar_fixtures ADD COLUMN side TEXT NOT NULL DEFAULT 'out'")
}

// Migration: position_text auf template_bar_fixtures — Freitext-Position bei Punktzug
{
  const cols = database.prepare("PRAGMA table_info(template_bar_fixtures)").all().map(c => c.name)
  if (!cols.includes('position_text'))
    database.exec("ALTER TABLE template_bar_fixtures ADD COLUMN position_text TEXT NOT NULL DEFAULT ''")
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

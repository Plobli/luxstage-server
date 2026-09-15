// LuxStage/server/tenant-backup.js
// Server-seitige Snapshots pro Mandant (Betreiber-gesteuert).
// Snapshots liegen unter data/backups/<tenantId>/<timestamp>.tar.gz und enthalten
// eine konsistente SQLite-.backup()-Kopie der DB (WAL-sicher, auch bei laufenden
// Schreibzugriffen) sowie die Datei-Ordner des Mandanten (photos/, floorplans/) —
// ohne die sind DB-Referenzen auf Fotos/Grundrisse nach einem Restore verwaist.
// Ältere reine .db-Snapshots (nur DB, keine Dateien) bleiben für Verify/Restore/
// Download lesbar (isLegacyDbSnapshot).
import Database from 'better-sqlite3'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { config } from './config.js'
import {
  isValidTenantId, tenantExists, tenantDir, tenantDbPath, openTenantDb, closeTenantDb,
} from './tenants.js'
import { listTenantIds } from './registry.js'

const execFileAsync = promisify(execFile)

const DAILY_MS = 24 * 60 * 60 * 1000

const BACKUPS_DIR = path.join(config.dataPath, 'backups')
const KEEP_PER_TENANT = 7 // Retention: letzte N Snapshots je Mandant
const DB_ENTRY_NAME = 'luxstage.db'
// Datei-Ordner im Mandantenverzeichnis, die zusätzlich zur DB gesichert werden.
const DATA_SUBDIRS = ['photos', 'floorplans']

function backupDir(tenantId) {
  if (!isValidTenantId(tenantId)) throw new Error(`Ungültige tenantId: ${tenantId}`)
  return path.join(BACKUPS_DIR, tenantId)
}

// Snapshot-Dateiname: sortierbarer Zeitstempel.
function snapshotName() {
  return new Date().toISOString().replace(/[:.]/g, '-') + '.tar.gz'
}

function isLegacyDbSnapshot(name) {
  return name.endsWith('.db')
}

// Erstellt einen konsistenten Snapshot aus Mandanten-DB und Datei-Ordnern
// (tar.gz). Gibt den Dateinamen zurück.
export async function createSnapshot(tenantId) {
  if (!tenantExists(tenantId)) throw new Error(`Mandant existiert nicht: ${tenantId}`)
  const dir = backupDir(tenantId)
  fs.mkdirSync(dir, { recursive: true })
  const name = snapshotName()
  const target = path.join(dir, name)

  const stagingDir = fs.mkdtempSync(path.join(BACKUPS_DIR, '.staging-'))
  try {
    // .backup() auf der offenen Verbindung -> konsistente Kopie trotz WAL/Schreibzugriff.
    await openTenantDb(tenantId).backup(path.join(stagingDir, DB_ENTRY_NAME))

    const tenantDataDir = tenantDir(tenantId)
    const existingSubdirs = DATA_SUBDIRS.filter(sub => fs.existsSync(path.join(tenantDataDir, sub)))
    // Datei-Ordner direkt aus dem Mandantenverzeichnis mitpacken (tar liest sie
    // aus zwei Wurzeln über -C je Argument), DB-Kopie aus dem Staging-Ordner.
    await execFileAsync('tar', [
      '-czf', target,
      '-C', stagingDir, DB_ENTRY_NAME,
      ...existingSubdirs.flatMap(sub => ['-C', tenantDataDir, sub]),
    ])
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }

  pruneSnapshots(tenantId)
  return name
}

// Liste der Snapshots (neueste zuerst) mit Größe und Zeitpunkt.
export function listSnapshots(tenantId) {
  const dir = backupDir(tenantId)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.tar.gz') || f.endsWith('.db'))
    .sort().reverse()
    .map(f => {
      const st = fs.statSync(path.join(dir, f))
      return { name: f, size: st.size, createdAt: st.mtimeMs }
    })
}

// Alte Snapshots über die Retention hinaus löschen.
function pruneSnapshots(tenantId) {
  const dir = backupDir(tenantId)
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tar.gz') || f.endsWith('.db')).sort().reverse()
  for (const f of files.slice(KEEP_PER_TENANT)) {
    fs.rmSync(path.join(dir, f), { force: true })
  }
}

// Prüft, ob eine Datei eine gültige LuxStage-DB ist (Sicherheitscheck vor Restore).
function isValidDbFile(file) {
  try {
    const db = new Database(file, { readonly: true })
    const ok = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()
    db.close()
    return !!ok
  } catch {
    return false
  }
}

// Entpackt einen tar.gz-Snapshot in ein temporäres Verzeichnis und liefert
// dessen Pfad sowie den Pfad zur enthaltenen DB-Datei zurück.
async function extractSnapshot(src) {
  const stagingDir = fs.mkdtempSync(path.join(BACKUPS_DIR, '.restore-'))
  await execFileAsync('tar', ['-xzf', src, '-C', stagingDir])
  return { stagingDir, dbFile: path.join(stagingDir, DB_ENTRY_NAME) }
}

// Stellt einen Snapshot wieder her: Vorher wird der Ist-Zustand gesichert.
// Die Aktivierung von DB und Datei-Ordnern erfolgt per Rename im Tenant-
// Verzeichnis und wird bei einem Fehler beim Wiederöffnen der DB auf den
// vorherigen Stand zurückgedreht. Legacy-.db-Snapshots (nur DB, keine
// Datei-Ordner) werden weiterhin unterstützt — die Datei-Ordner bleiben dabei
// unverändert.
export async function restoreSnapshot(tenantId, name) {
  if (!isValidTenantId(tenantId)) throw new Error('Ungültige tenantId')
  // Pfad-Traversal ausschließen: nur Dateinamen aus dem Backup-Verzeichnis.
  if (name.includes('/') || name.includes('..') || !(name.endsWith('.tar.gz') || name.endsWith('.db'))) {
    throw new Error('Ungültiger Snapshot-Name')
  }
  const src = path.join(backupDir(tenantId), name)
  if (!fs.existsSync(src)) throw new Error('Snapshot nicht gefunden')

  const legacy = isLegacyDbSnapshot(name)
  let extractedDir = null
  let dbSrc = src
  let dataSubdirs = []
  if (!legacy) {
    const extracted = await extractSnapshot(src)
    extractedDir = extracted.stagingDir
    dbSrc = extracted.dbFile
    dataSubdirs = DATA_SUBDIRS.filter(sub => fs.existsSync(path.join(extractedDir, sub)))
  }
  if (!isValidDbFile(dbSrc)) {
    if (extractedDir) fs.rmSync(extractedDir, { recursive: true, force: true })
    throw new Error('Snapshot ist keine gültige LuxStage-Datenbank')
  }

  const dbPath = tenantDbPath(tenantId)
  const tenantDataDir = tenantDir(tenantId)
  await createSnapshot(tenantId)

  const suffix = `.restore-${process.pid}-${Date.now()}`
  const stagedPath = dbPath + suffix
  const previousPath = dbPath + '.before-restore'
  const previousWalPath = previousPath + '-wal'
  const previousShmPath = previousPath + '-shm'
  // Vorherige Datei-Ordner werden bei Erfolg gelöscht bzw. bei Fehler
  // zurückgetauscht — parallel zur DB-Rollback-Logik.
  const previousSubdirPaths = dataSubdirs.map(sub => path.join(tenantDataDir, `.before-restore-${sub}`))

  fs.copyFileSync(dbSrc, stagedPath)
  if (!isValidDbFile(stagedPath)) {
    fs.rmSync(stagedPath, { force: true })
    if (extractedDir) fs.rmSync(extractedDir, { recursive: true, force: true })
    throw new Error('Snapshot konnte nicht vorbereitet werden')
  }

  closeTenantDb(tenantId)
  let previousMoved = false
  try {
    fs.renameSync(dbPath, previousPath)
    previousMoved = true
    moveIfExists(dbPath + '-wal', previousWalPath)
    moveIfExists(dbPath + '-shm', previousShmPath)
    dataSubdirs.forEach((sub, i) => {
      moveIfExists(path.join(tenantDataDir, sub), previousSubdirPaths[i])
      fs.renameSync(path.join(extractedDir, sub), path.join(tenantDataDir, sub))
    })
    fs.renameSync(stagedPath, dbPath)
    openTenantDb(tenantId)
  } catch (err) {
    if (!previousMoved) {
      fs.rmSync(stagedPath, { force: true })
      openTenantDb(tenantId)
      throw new Error(`Snapshot konnte nicht vorbereitet werden: ${err.message}`)
    }
    closeTenantDb(tenantId)
    fs.rmSync(dbPath, { force: true })
    fs.rmSync(dbPath + '-wal', { force: true })
    fs.rmSync(dbPath + '-shm', { force: true })
    moveIfExists(previousPath, dbPath)
    moveIfExists(previousWalPath, dbPath + '-wal')
    moveIfExists(previousShmPath, dbPath + '-shm')
    dataSubdirs.forEach((sub, i) => {
      fs.rmSync(path.join(tenantDataDir, sub), { recursive: true, force: true })
      moveIfExists(previousSubdirPaths[i], path.join(tenantDataDir, sub))
    })
    fs.rmSync(stagedPath, { force: true })
    openTenantDb(tenantId)
    throw new Error(`Snapshot konnte nicht aktiviert werden: ${err.message}`)
  }

  fs.rmSync(previousPath, { force: true })
  fs.rmSync(previousWalPath, { force: true })
  fs.rmSync(previousShmPath, { force: true })
  for (const p of previousSubdirPaths) fs.rmSync(p, { recursive: true, force: true })
  if (extractedDir) fs.rmSync(extractedDir, { recursive: true, force: true })
}

function moveIfExists(source, target) {
  if (fs.existsSync(source)) fs.renameSync(source, target)
}

// Prüft die Konsistenz eines gespeicherten Snapshots (Betreiber-Panel
// "Prüfen"-Button). Öffnet die Datei readonly, unabhängig von der aktiven
// Mandanten-Verbindung — kein Trockenlauf-Restore, quick_check reicht, um
// Datei-Korruption zu erkennen (die restoreSnapshot()-Mechanik selbst ist
// bereits in tenant-backup.test.js getestet).
export async function verifySnapshot(tenantId, name) {
  if (name.includes('/') || name.includes('..') || !(name.endsWith('.tar.gz') || name.endsWith('.db'))) {
    return { ok: false, error: 'Ungültiger Snapshot-Name' }
  }
  const p = path.join(backupDir(tenantId), name)
  if (!fs.existsSync(p)) return { ok: false, error: 'Snapshot nicht gefunden' }

  let dbFile = p
  let extractedDir = null
  if (!isLegacyDbSnapshot(name)) {
    try {
      const extracted = await extractSnapshot(p)
      extractedDir = extracted.stagingDir
      dbFile = extracted.dbFile
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  let db
  try {
    db = new Database(dbFile, { readonly: true })
  } catch (err) {
    if (extractedDir) fs.rmSync(extractedDir, { recursive: true, force: true })
    return { ok: false, error: err.message }
  }
  try {
    const rows = db.pragma('quick_check')
    const issues = rows
      .map(row => (typeof row === 'string' ? row : row.quick_check))
      .filter(value => value !== 'ok')
    return { ok: issues.length === 0, issues }
  } catch (err) {
    return { ok: false, error: err.message }
  } finally {
    db.close()
    if (extractedDir) fs.rmSync(extractedDir, { recursive: true, force: true })
  }
}

// Snapshot einer Datei zum Download bereitstellen (absoluter Pfad oder null).
export function snapshotPath(tenantId, name) {
  if (name.includes('/') || name.includes('..') || !(name.endsWith('.tar.gz') || name.endsWith('.db'))) return null
  const p = path.join(backupDir(tenantId), name)
  return fs.existsSync(p) ? p : null
}

// Backup-Verzeichnis eines Mandanten löschen (bei Mandanten-Löschung aufrufen).
export function deleteBackups(tenantId) {
  fs.rmSync(backupDir(tenantId), { recursive: true, force: true })
}

// Täglicher Auto-Snapshot aller Mandanten. Nur im SaaS-Modus sinnvoll.
async function backupAllTenants() {
  for (const id of listTenantIds()) {
    try {
      const name = await createSnapshot(id)
      console.log(`[backup] Auto-Snapshot: ${id}/${name}`)
    } catch (err) {
      console.error(`[backup] Mandant ${id} übersprungen:`, err.message)
    }
  }
}

export function startBackupJob() {
  if (!config.baseDomain) return // nur SaaS-Modus
  setInterval(() => { backupAllTenants().catch(() => {}) }, DAILY_MS)
  console.log('[backup] Täglicher Mandanten-Backup-Job aktiv')
}

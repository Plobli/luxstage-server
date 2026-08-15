// LuxStage/server/tenant-backup.js
// Server-seitige Snapshots pro Mandant (Betreiber-gesteuert).
// Snapshots liegen unter data/backups/<tenantId>/<timestamp>.db — konsistente
// SQLite-.backup()-Kopien (WAL-sicher, auch bei laufenden Schreibzugriffen).
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import {
  isValidTenantId, tenantExists, tenantDbPath, openTenantDb, closeTenantDb,
} from './tenants.js'
import { listTenantIds } from './registry.js'

const DAILY_MS = 24 * 60 * 60 * 1000

const BACKUPS_DIR = path.join(config.dataPath, 'backups')
const KEEP_PER_TENANT = 7 // Retention: letzte N Snapshots je Mandant

function backupDir(tenantId) {
  if (!isValidTenantId(tenantId)) throw new Error(`Ungültige tenantId: ${tenantId}`)
  return path.join(BACKUPS_DIR, tenantId)
}

// Snapshot-Dateiname: sortierbarer Zeitstempel.
function snapshotName() {
  return new Date().toISOString().replace(/[:.]/g, '-') + '.db'
}

// Erstellt einen konsistenten Snapshot der Mandanten-DB. Gibt den Dateinamen zurück.
export async function createSnapshot(tenantId) {
  if (!tenantExists(tenantId)) throw new Error(`Mandant existiert nicht: ${tenantId}`)
  const dir = backupDir(tenantId)
  fs.mkdirSync(dir, { recursive: true })
  const name = snapshotName()
  const target = path.join(dir, name)
  // .backup() auf der offenen Verbindung -> konsistente Kopie trotz WAL/Schreibzugriff.
  await openTenantDb(tenantId).backup(target)
  pruneSnapshots(tenantId)
  return name
}

// Liste der Snapshots (neueste zuerst) mit Größe und Zeitpunkt.
export function listSnapshots(tenantId) {
  const dir = backupDir(tenantId)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.db'))
    .sort().reverse()
    .map(f => {
      const st = fs.statSync(path.join(dir, f))
      return { name: f, size: st.size, createdAt: st.mtimeMs }
    })
}

// Alte Snapshots über die Retention hinaus löschen.
function pruneSnapshots(tenantId) {
  const dir = backupDir(tenantId)
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.db')).sort().reverse()
  for (const f of files.slice(KEEP_PER_TENANT)) {
    fs.rmSync(path.join(dir, f), { force: true })
  }
}

// Prüft, ob eine Snapshot-Datei eine gültige LuxStage-DB ist (Sicherheitscheck vor Restore).
function isValidSnapshot(file) {
  try {
    const db = new Database(file, { readonly: true })
    const ok = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()
    db.close()
    return !!ok
  } catch {
    return false
  }
}

// Stellt einen Snapshot wieder her: Vorher wird der Ist-Zustand gesichert.
// Die Aktivierung erfolgt per Rename im Tenant-Verzeichnis und wird bei einem
// Fehler beim Wiederöffnen der DB auf den vorherigen Stand zurückgedreht.
export async function restoreSnapshot(tenantId, name) {
  if (!isValidTenantId(tenantId)) throw new Error('Ungültige tenantId')
  // Pfad-Traversal ausschließen: nur Dateinamen aus dem Backup-Verzeichnis.
  if (name.includes('/') || name.includes('..') || !name.endsWith('.db')) {
    throw new Error('Ungültiger Snapshot-Name')
  }
  const src = path.join(backupDir(tenantId), name)
  if (!fs.existsSync(src)) throw new Error('Snapshot nicht gefunden')
  if (!isValidSnapshot(src)) throw new Error('Snapshot ist keine gültige LuxStage-Datenbank')

  const dbPath = tenantDbPath(tenantId)
  await createSnapshot(tenantId)

  const suffix = `.restore-${process.pid}-${Date.now()}`
  const stagedPath = dbPath + suffix
  const previousPath = dbPath + '.before-restore'
  const previousWalPath = previousPath + '-wal'
  const previousShmPath = previousPath + '-shm'

  fs.copyFileSync(src, stagedPath)
  if (!isValidSnapshot(stagedPath)) {
    fs.rmSync(stagedPath, { force: true })
    throw new Error('Snapshot konnte nicht vorbereitet werden')
  }

  closeTenantDb(tenantId)
  let previousMoved = false
  try {
    fs.renameSync(dbPath, previousPath)
    previousMoved = true
    moveIfExists(dbPath + '-wal', previousWalPath)
    moveIfExists(dbPath + '-shm', previousShmPath)
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
    fs.rmSync(stagedPath, { force: true })
    openTenantDb(tenantId)
    throw new Error(`Snapshot konnte nicht aktiviert werden: ${err.message}`)
  }

  fs.rmSync(previousPath, { force: true })
  fs.rmSync(previousWalPath, { force: true })
  fs.rmSync(previousShmPath, { force: true })
}

function moveIfExists(source, target) {
  if (fs.existsSync(source)) fs.renameSync(source, target)
}

// Snapshot einer Datei zum Download bereitstellen (absoluter Pfad oder null).
export function snapshotPath(tenantId, name) {
  if (name.includes('/') || name.includes('..') || !name.endsWith('.db')) return null
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

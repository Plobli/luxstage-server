// LuxStage/server/tenants.js
// Mandanten-Verwaltung: eine SQLite-Datei pro Kunde unter data/tenants/<id>/luxstage.db.
// Legt NUR die leere, schema-initialisierte DB an — niemals einen User.
// Der erste Admin entsteht ausschließlich durch die Registrierungs-Route.
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { initSchema } from './db-init.js'
import { logger } from './logger.js'

const log = logger('tenants')

const TENANTS_DIR = path.join(config.dataPath, 'tenants')

// Offene Verbindungen wiederverwenden (better-sqlite3 ist synchron, eine Verbindung pro DB genügt).
// Map hält Einfügereihenfolge — der älteste Eintrag ist damit der am längsten
// ungenutzte und wird beim Erreichen der Grenze verdrängt. Ohne Obergrenze
// hielte jeder je aktive Mandant dauerhaft ein Datei-Handle samt WAL offen.
export const MAX_OPEN_TENANT_DBS = 50
const connections = new Map() // tenantId → Database

// Zählt laufende Requests je Mandant (router.js markiert Beginn/Ende). Ohne
// das würde evictOldest() eine Verbindung schließen können, die eine noch
// laufende Anfrage (z.B. langsamer Foto-Upload) gerade in AsyncLocalStorage
// hält — die Anfrage bräche dann mit "database connection is not open" ab.
const inUseCounts = new Map() // tenantId → Anzahl laufender Requests

export function markTenantInUse(tenantId) {
  inUseCounts.set(tenantId, (inUseCounts.get(tenantId) || 0) + 1)
}

export function releaseTenantInUse(tenantId) {
  const n = (inUseCounts.get(tenantId) || 0) - 1
  if (n <= 0) inUseCounts.delete(tenantId)
  else inUseCounts.set(tenantId, n)
}

// Anzahl aktuell offener Mandanten-Verbindungen (Diagnose/Tests).
export function openConnectionCount() {
  return connections.size
}

function touch(tenantId, db) {
  connections.delete(tenantId)
  connections.set(tenantId, db)
}

function evictOldest() {
  while (connections.size >= MAX_OPEN_TENANT_DBS) {
    let oldest = null
    for (const id of connections.keys()) {
      if (!inUseCounts.get(id)) { oldest = id; break }
    }
    if (oldest === null) {
      // Jede offene Verbindung wird gerade von einem laufenden Request
      // gehalten — lieber vorübergehend über die Obergrenze wachsen, als eine
      // aktive Anfrage mit einer geschlossenen Verbindung abstürzen zu lassen.
      log.warn('Alle offenen Mandanten-Verbindungen in Benutzung, Obergrenze überschritten', { offen: connections.size })
      return
    }
    const db = connections.get(oldest)
    if (db?.open) db.close()
    connections.delete(oldest)
  }
}

// tenantId strikt validieren: nur Kleinbuchstaben, Ziffern, Bindestrich.
// Verhindert Pfad-Traversal und uneindeutige Dateinamen.
export function isValidTenantId(tenantId) {
  return typeof tenantId === 'string' && /^[a-z0-9][a-z0-9-]{1,62}$/.test(tenantId)
}

export function tenantDir(tenantId) {
  if (!isValidTenantId(tenantId)) throw new Error(`Ungültige tenantId: ${tenantId}`)
  return path.join(TENANTS_DIR, tenantId)
}

export function tenantDbPath(tenantId) {
  return path.join(tenantDir(tenantId), 'luxstage.db')
}

export function tenantExists(tenantId) {
  if (!isValidTenantId(tenantId)) return false
  return fs.existsSync(tenantDbPath(tenantId))
}

// Öffnet (und cached) die DB eines bestehenden Mandanten. Legt nichts an.
// Wirft, wenn der Mandant nicht existiert — Aufrufer muss tenantExists prüfen.
export function openTenantDb(tenantId) {
  if (!isValidTenantId(tenantId)) throw new Error(`Ungültige tenantId: ${tenantId}`)
  const cached = connections.get(tenantId)
  if (cached && cached.open) { touch(tenantId, cached); return cached }
  if (!tenantExists(tenantId)) throw new Error(`Mandant existiert nicht: ${tenantId}`)
  evictOldest()
  const db = new Database(tenantDbPath(tenantId))
  try {
    initSchema(db) // idempotent — hält bestehende DBs auf aktuellem Schema
  } catch (err) {
    // Ohne dieses close() bliebe bei fehlgeschlagenem initSchema() ein offenes,
    // nirgends getracktes Datei-Handle zurück — nicht im connections-Cache
    // (also nicht über closeTenantDb() erreichbar), aber auch nicht geschlossen.
    db.close()
    throw err
  }
  connections.set(tenantId, db)
  return db
}

// Legt eine neue, leere Mandanten-DB an (Schema initialisiert, KEINE User).
// Wirft, wenn der Mandant bereits existiert.
export function createTenant(tenantId) {
  if (!isValidTenantId(tenantId)) throw new Error(`Ungültige tenantId: ${tenantId}`)
  if (tenantExists(tenantId)) throw new Error(`Mandant existiert bereits: ${tenantId}`)
  fs.mkdirSync(tenantDir(tenantId), { recursive: true })
  evictOldest()
  const db = new Database(tenantDbPath(tenantId))
  try {
    initSchema(db)
  } catch (err) {
    // Siehe openTenantDb: ohne dieses close() bliebe bei fehlgeschlagenem
    // initSchema() ein offenes, nirgends getracktes Datei-Handle zurück.
    db.close()
    throw err
  }
  connections.set(tenantId, db)
  return db
}

// Verbindung schließen und aus dem Cache entfernen (z. B. vor dem Löschen).
export function closeTenantDb(tenantId) {
  const db = connections.get(tenantId)
  if (db && db.open) db.close()
  connections.delete(tenantId)
}

// Mandant vollständig entfernen: Verbindung schließen, Verzeichnis löschen.
// Für DSGVO-Löschung und Wegwerf-Demo-Aufräumen.
export function deleteTenant(tenantId) {
  if (!isValidTenantId(tenantId)) throw new Error(`Ungültige tenantId: ${tenantId}`)
  closeTenantDb(tenantId)
  fs.rmSync(tenantDir(tenantId), { recursive: true, force: true })
}

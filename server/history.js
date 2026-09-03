// LuxStage/server/history.js
import { createHash, randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { getDb, runWithDb } from './db-context.js'
import { saasEnabled } from './saas.js'
import { readChannels, writeChannels } from './db/channels.js'
import { readShowSections, writeShowSections } from './db/sections.js'

// SaaS-Helfer (Mandanten-Iteration, Purge) nur im SaaS-Modus dynamisch laden.
let saasMod = null
async function loadSaasHelpers() {
  if (!saasEnabled || saasMod) return saasMod
  const [tenants, registry] = await Promise.all([import('./tenants.js'), import('./registry.js')])
  saasMod = {
    openTenantDb: tenants.openTenantDb,
    listTenantIds: registry.listTenantIds,
    purgeExpiredPending: registry.purgeExpiredPending,
  }
  return saasMod
}

const INTERVAL_MS = 10 * 60 * 1000  // 10 Minuten
const PURGE_INTERVAL_MS = 60 * 60 * 1000  // 1 Stunde
const MAX_HISTORY = 50

// Map<showId, lastSnapshotHash>
const snapshotHashes = new Map()

function computeHash(channels, sections) {
  // sections als Objekt mit sortierten Keys für Determinismus
  const sortedSections = Object.fromEntries(
    [...sections.entries()].sort(([a], [b]) => a.localeCompare(b))
  )
  const data = JSON.stringify({ channels, sections: sortedSections })
  return createHash('sha256').update(data).digest('hex')
}

function initHashes() {
  const shows = getDb().prepare('SELECT id, slug FROM shows WHERE archived = 0').all()
  for (const show of shows) {
    const channels = readChannels(show.slug)
    const sections = readShowSections(show.slug)
    snapshotHashes.set(show.id, computeHash(channels, sections))
  }
}

function snapshotOneShow(show) {
  let newHash = null
  const tx = getDb().transaction(() => {
    const channels = readChannels(show.slug)
    const sections = readShowSections(show.slug)
    const currentHash = computeHash(channels, sections)
    if (currentHash === snapshotHashes.get(show.id)) return  // early return from transaction

    const id = randomUUID()
    const sectionsObj = Object.fromEntries(sections)
    getDb().prepare(`
      INSERT INTO history (id, show_id, created_at, channels, sections)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, show.id, Date.now(), JSON.stringify(channels), JSON.stringify(sectionsObj))

    getDb().prepare(`
      DELETE FROM history WHERE show_id = ? AND id NOT IN (
        SELECT id FROM history WHERE show_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(show.id, show.id, MAX_HISTORY)

    newHash = currentHash
  })
  tx()
  if (newHash) snapshotHashes.set(show.id, newHash)
}

// better-sqlite3 ist synchron: ohne die Pause zwischen den Shows blockiert ein
// Lauf über viele Shows (im SaaS zusätzlich über alle Mandanten) den einzigen
// Node-Thread am Stück — kein SSE-Heartbeat, kein Login, kein Upload solange.
async function takeSnapshots() {
  const shows = getDb().prepare('SELECT id, slug FROM shows WHERE archived = 0').all()
  for (const show of shows) {
    snapshotOneShow(show)
    await sleep(0)
  }
}

// Führt fn für jeden Mandanten im jeweiligen DB-Kontext aus. Im Self-Hosted-Modus
// (keine SaaS-Module) läuft fn einmal gegen die globale DB.
async function forEachTenant(fn) {
  if (!saasMod) return fn() // Self-Hosted: globale DB
  const ids = saasMod.listTenantIds()
  if (ids.length === 0) return fn()
  for (const id of ids) {
    try {
      await runWithDb(saasMod.openTenantDb(id), fn, id)
    } catch (err) {
      console.error(`[history] Mandant ${id} übersprungen:`, err.message)
    }
  }
}

// Macht die Blockierdauer sichtbar, bevor sie im Betrieb schmerzt.
async function runSnapshotCycle() {
  const t0 = Date.now()
  await forEachTenant(takeSnapshots)
  const ms = Date.now() - t0
  if (ms > 1000) console.warn(`[history] Snapshot-Lauf dauerte ${ms}ms — Event-Loop blockiert`)
}

export async function startHistoryJob() {
  await loadSaasHelpers()
  await forEachTenant(initHashes)
  // Automatische Snapshots laufen weiter als Fallback (z.B. für Änderungen via API ohne Browser)
  setInterval(() => { runSnapshotCycle().catch(err => console.error('[history] Snapshot-Lauf fehlgeschlagen:', err)) }, INTERVAL_MS)

  // Abgelaufene Registrierungen periodisch aufräumen — nur SaaS (Doppel-Opt-In-TTL).
  if (saasMod) {
    setInterval(() => {
      const removed = saasMod.purgeExpiredPending()
      if (removed) console.log(`[register] ${removed} abgelaufene Registrierung(en) entfernt`)
    }, PURGE_INTERVAL_MS)
  }
}

/** Erzeugt sofort einen Snapshot für eine Show — unabhängig vom Hash-Vergleich.
 *  Wird beim Öffnen einer Show aufgerufen, um einen Ausgangspunkt zu sichern.
 *  `includeArchived` nur für Fälle, in denen der aktuelle Stand gleich
 *  überschrieben wird (Restore) — archivierte Shows sollen sonst keine
 *  Snapshots sammeln. */
export function takeSnapshotNow(slug, includeArchived = false) {
  const show = includeArchived
    ? getDb().prepare('SELECT id, slug FROM shows WHERE slug = ?').get(slug)
    : getDb().prepare('SELECT id, slug FROM shows WHERE slug = ? AND archived = 0').get(slug)
  if (!show) return false

  let newHash = null
  const tx = getDb().transaction(() => {
    const channels = readChannels(slug)
    const sections = readShowSections(slug)
    const currentHash = computeHash(channels, sections)

    // Keinen doppelten Snapshot erstellen wenn sich seit dem letzten nichts geändert hat
    const lastEntry = getDb().prepare(
      'SELECT id FROM history WHERE show_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(show.id)
    if (lastEntry) {
      const lastFull = getDb().prepare('SELECT channels, sections FROM history WHERE id = ?').get(lastEntry.id)
      const lastChannels = JSON.parse(lastFull.channels)
      const lastSections = new Map(Object.entries(JSON.parse(lastFull.sections)))
      if (computeHash(lastChannels, lastSections) === currentHash) return  // early return, no snapshot needed
    }

    const id = randomUUID()
    const sectionsObj = Object.fromEntries(sections)
    getDb().prepare(`
      INSERT INTO history (id, show_id, created_at, channels, sections)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, show.id, Date.now(), JSON.stringify(channels), JSON.stringify(sectionsObj))

    getDb().prepare(`
      DELETE FROM history WHERE show_id = ? AND id NOT IN (
        SELECT id FROM history WHERE show_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(show.id, show.id, MAX_HISTORY)

    newHash = currentHash
  })
  tx()
  if (newHash) snapshotHashes.set(show.id, newHash)
  return true
}

// History-Abfragen für API
export function listHistory(slug) {
  const show = getDb().prepare('SELECT id FROM shows WHERE slug = ?').get(slug)
  if (!show) return []
  return getDb().prepare('SELECT id, created_at FROM history WHERE show_id = ? ORDER BY created_at DESC').all(show.id)
}

export function getHistoryEntry(slug, historyId) {
  const show = getDb().prepare('SELECT id FROM shows WHERE slug = ?').get(slug)
  if (!show) return null
  return getDb().prepare('SELECT * FROM history WHERE id = ? AND show_id = ?').get(historyId, show.id) ?? null
}

export function restoreHistoryEntry(slug, historyId) {
  const show = getDb().prepare('SELECT id FROM shows WHERE slug = ?').get(slug)
  if (!show) return false
  const entry = getDb().prepare('SELECT * FROM history WHERE id = ? AND show_id = ?').get(historyId, show.id)
  if (!entry) return false

  const channels = JSON.parse(entry.channels)
  const sections = new Map(Object.entries(JSON.parse(entry.sections)))

  // Der aktuelle Stand wird gleich überschrieben und ist sonst unwiederbringlich
  // weg — der 10-Minuten-Takt hat ihn womöglich noch nicht erfasst. Bewusst vor
  // der Transaktion: takeSnapshotNow öffnet eine eigene, und better-sqlite3
  // erlaubt keine verschachtelten Transaktionen. Doppelte Einträge entstehen
  // nicht, takeSnapshotNow vergleicht selbst gegen den letzten Snapshot.
  takeSnapshotNow(slug, true)

  const tx = getDb().transaction(() => {
    writeChannels(slug, channels)
    writeShowSections(slug, sections)
  })
  tx()

  snapshotHashes.set(show.id, computeHash(channels, sections))
  return true
}

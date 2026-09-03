/**
 * sse.js — Server-Sent Events für Realtime Kanal-Updates + Presence
 * Clients abonnieren /api/shows/:id/events
 *
 * Event-Katalog (broadcast()/sendToUser() in routes/*.js): channels-updated,
 * sections-updated, towers-updated, bars-updated, floorplan-updated, checks-updated,
 * lock-status-updated, lock-takeover-requested, presence-updated.
 *
 * Der Web-Client (web-app/src/api/client.ts, subscribeShow()) hört bewusst nur drei davon ab
 * (lock-status-updated, lock-takeover-requested, presence-updated) — die sechs
 * datenverändernden Events sind KEIN totes Gepäck, sondern für native Clients reserviert bzw.
 * Grundlage für ein späteres optimistischeres Update-Modell im Web; das Fehlen ihrer Nutzung
 * im Web-Client ist der Grund, warum der pessimistische Exklusiv-Lock (router.js,
 * WRITE_METHODS-Gate) dort weiterhin architektonisch notwendig ist, nicht nur eine
 * Vorsichtsmaßnahme. Siehe audits/architecture-analysis-2026-09-03.md, F-02.
 */
import { getTenantId } from './db-context.js'

// tenantId:showId → Map<res, { username, device }>
// Slugs sind nur pro Mandanten-DB eindeutig — der Tenant-Präfix verhindert,
// dass Mandanten mit gleichnamiger Show sich gegenseitig Updates mithören.
const clients = new Map()

function scopedKey(showId) {
  return `${getTenantId() ?? ''}:${showId}`
}

function initShow(showId) {
  if (!clients.has(showId)) clients.set(showId, new Map())
}

export function subscribe(showId, res, username, device, getChecksFn) {
  const key = scopedKey(showId)
  initShow(key)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  res.write(':\n\n') // Verbindung bestätigen

  const map = clients.get(key)
  map.set(res, { username, device, lastActivityAt: new Date().toISOString() })

  // Aktuellen Check-State sofort an den neuen Client senden
  if (getChecksFn) {
    const checks = getChecksFn(showId)
    const msg = `event: checks-updated\ndata: ${JSON.stringify({ checks })}\n\n`
    try { res.write(msg) } catch { /* ignore */ }
  }

  // Neue Presence sofort an alle senden
  broadcastPresence(showId)

  res.on('close', () => {
    map.delete(res)
    broadcastPresence(showId)
  })
}

export function broadcast(showId, event, data) {
  const map = clients.get(scopedKey(showId))
  if (!map?.size) return
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of map.keys()) {
    try { res.write(msg) } catch { map.delete(res) }
  }
}

/** Wie broadcast(), aber nur an Clients eines bestimmten Users (z.B. Übernahme-Anfrage an den Lock-Halter). */
export function sendToUser(showId, username, event, data) {
  const map = clients.get(scopedKey(showId))
  if (!map?.size) return
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const [res, client] of map) {
    if (client.username !== username) continue
    try { res.write(msg) } catch { map.delete(res) }
  }
}

function aggregatePresence(map) {
  const byUser = new Map()
  for (const { username, device, lastActivityAt } of map.values()) {
    if (!byUser.has(username)) {
      byUser.set(username, { devices: new Set(), lastActivityAt })
    } else {
      const entry = byUser.get(username)
      entry.lastActivityAt = new Date(Math.max(
        new Date(entry.lastActivityAt).getTime(),
        new Date(lastActivityAt).getTime()
      )).toISOString()
    }
    byUser.get(username).devices.add(device)
  }
  return Array.from(byUser.entries()).map(([username, { devices, lastActivityAt }]) => ({
    username,
    devices: Array.from(devices),
    lastActivityAt,
  }))
}

function broadcastPresence(showId) {
  const map = clients.get(scopedKey(showId))
  if (!map) return
  broadcast(showId, 'presence-updated', { users: aggregatePresence(map) })
}

export function getPresence(showId) {
  const map = clients.get(scopedKey(showId))
  if (!map?.size) return []
  return aggregatePresence(map)
}

// Heartbeat: tote Sockets entfernen, Verbindungsabbrüche durch Reverse-Proxies verhindern
const heartbeat = setInterval(() => {
  for (const map of clients.values()) {
    for (const res of map.keys()) {
      res.write(':\n\n', (err) => {
        if (err) { map.delete(res); res.end() }
      })
    }
  }
}, 15_000)
heartbeat.unref()

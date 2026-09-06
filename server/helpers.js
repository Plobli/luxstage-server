import { config } from './config.js'
import { requireShow } from './db/shows.js'
import { withUndoSnapshot } from './db/operations.js'
import { broadcast } from './sse.js'

export function clientIp(req) {
  if (config.trustProxy && req.headers['x-forwarded-for']) {
    // Reverse-Proxies (Caddy eingeschlossen) haengen die echte Client-IP an
    // einen ggf. bereits vorhandenen Header an, statt ihn zu ersetzen — der
    // letzte Eintrag ist der vom naechsten (vertrauenswuerdigen) Hop
    // gesetzte Wert, der erste ist client-kontrolliert und damit spoofbar.
    const parts = req.headers['x-forwarded-for'].split(',')
    return parts[parts.length - 1].trim()
  }
  return req.socket.remoteAddress || 'unknown'
}

export function readBodyBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0
    req.on('data', c => {
      size += c.length
      if (size > maxBytes) { req.destroy(); return reject(new Error('Body zu groß')) }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function readBody(req, maxBytes = 1_048_576) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0
    req.on('data', c => {
      size += c.length
      if (size > maxBytes) { req.destroy(); return reject(new Error('Body zu groß')) }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// Günstige Post-Parse-Tiefenprüfung statt eines eigenen Streaming-Parsers:
// JSON.parse() ist nativ und deutlich schneller als ein manueller Parser mit
// Tiefe-Tracking während des Parsens — die Body-Größe ist bereits auf 1 MB
// begrenzt, das Risiko ist rekursive Downstream-Verarbeitung ohne eigenes
// Tiefenlimit (aktuell keine solche Logik gefunden, aber nicht für jeden
// db/*.js-Mutation-Helper einzeln verifizierbar).
const MAX_JSON_DEPTH = 50
function exceedsMaxDepth(value, depth = 0) {
  if (depth > MAX_JSON_DEPTH) return true
  if (Array.isArray(value)) return value.some(v => exceedsMaxDepth(v, depth + 1))
  if (value && typeof value === 'object') return Object.values(value).some(v => exceedsMaxDepth(v, depth + 1))
  return false
}

export async function readJsonBody(req, res, maxBytes) {
  let raw
  try { raw = await readBody(req, maxBytes) } catch {
    json(res, 413, { error: 'Request zu groß' }); return null
  }
  if (!raw.trim()) return {}
  let parsed
  try { parsed = JSON.parse(raw) } catch {
    json(res, 400, { error: 'Ungültiger JSON-Body' }); return null
  }
  if (exceedsMaxDepth(parsed)) {
    json(res, 400, { error: 'JSON-Body zu tief verschachtelt' }); return null
  }
  return parsed
}

export function json(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders })
  res.end(JSON.stringify(data))
}

export function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType })
  res.end(body)
}

export function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Nicht gefunden' }))
}

// Kondensiert die in server/routes/*.js wiederkehrende Prüfung
// `method === X && REGEX.test(pathname)` auf einen Aufruf (siehe
// audits/software-design-analysis-2026-09-05.md, Finding #7.3). Bewusst kein
// Lookup-Table/Router-Aufbau: die Handler-Blöcke in den Routendateien enthalten
// substanzielle Logik mit frühen Returns, keine reinen Funktionsreferenzen —
// eine Tabelle würde diese Blöcke nur umständlicher machen, nicht vereinfachen.
export function isRoute(method, pathname, expectedMethod, regex) {
  return method === expectedMethod && regex.test(pathname)
}

// Kondensiert das in routes/bars.js, routes/towers.js, routes/sections.js,
// routes/channels.js ~16x wiederholte Muster "Show laden + 404-Guard,
// mutate() im Undo-Snapshot ausführen, SSE-Broadcast, JSON-Antwort" (siehe
// audits/code-duplication-audit-2026-09-03.md, F1). `mutate` bekommt die
// geladene Show und darf einen Wert zurückgeben, der in `responseBody`
// (Funktion des Rückgabewerts) landet — deckt sowohl "{ ok: true }" als auch
// "{ id }"/"{ ok: true, id }" ab, ohne dass jeder Aufrufer den Show-Lookup,
// den Undo-Wrapper und den Broadcast selbst wiederholen muss.
export async function withShowMutation(req, res, slug, eventName, mutate, { status = 200, responseBody = () => ({ ok: true }), broadcastPayload = () => ({}) } = {}) {
  const user = req.user
  const show = requireShow(slug, res)
  if (!show) return
  const result = withUndoSnapshot(slug, show.id, user.username, () => mutate(show))
  broadcast(slug, eventName, broadcastPayload(user))
  return json(res, status, responseBody(result))
}

export function parseUrl(url) {
  const u = new URL(url, 'http://localhost')
  return { pathname: u.pathname, search: u.search, params: Object.fromEntries(u.searchParams) }
}

// Multipart-Upload-Fehler (busboy-Limits, s. photos.js parseMultipart) tragen "zu groß"/
// "zu viele" in der Message — alles andere ist ein regulärer Verarbeitungsfehler (400).
export function uploadErrorStatus(message) {
  return /zu groß|zu viele/i.test(message || '') ? 413 : 400
}

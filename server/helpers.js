import { config } from './config.js'
import { requireShow } from './db/shows.js'
import { withUndoSnapshot } from './db/operations.js'
import { broadcast } from './sse.js'

export function clientIp(req) {
  if (config.trustProxy && req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim()
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

export async function readJsonBody(req, res, maxBytes) {
  let raw
  try { raw = await readBody(req, maxBytes) } catch {
    json(res, 413, { error: 'Request zu groß' }); return null
  }
  if (!raw.trim()) return {}
  try { return JSON.parse(raw) } catch {
    json(res, 400, { error: 'Ungültiger JSON-Body' }); return null
  }
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

// Übergangsschicht für App-Builds vor der Umbenennung (bars/floorplan → battens/drawing plan).
//
// Clients mit Header `X-Api-Version: 2` (oder Query `api_version=2`, für EventSource) bekommen die
// neuen Namen. Alle anderen gelten als alt: Pfade werden umgeschrieben, JSON-Antworten und
// SSE-Events auf alte Namen zurückübersetzt. Anfragen werden immer in neue Namen übersetzt
// (siehe readJsonBody).
//
// ENTFERNEN: Zeilen mit `[legacy-api]` im Log zeigen, welche Clients noch alt sind. Gibt es
// mehrere Wochen keine mehr, diese Datei löschen und die drei Einhängepunkte entfernen
// (router.js, helpers.js readJsonBody, sse.js formatEvent). Danach `X-Api-Version` ignorieren.
import { logger } from './logger.js'

const log = logger('legacy-api')

const PATH_REWRITES = [
  [/^(\/api\/(?:shows|templates)\/[^/]+)\/bars(?=\/|$)/, '$1/battens'],
  [/^(\/api\/(?:shows|templates)\/[^/]+)\/floorplan(?=\/|$)/, '$1/drawing-plan'],
  [/^\/api\/floorplans\//, '/api/drawing-plans/'],
]
const LEGACY_EVENTS = { 'battens-updated': 'bars-updated', 'drawing-plan-updated': 'floorplan-updated' }
const JSON_STRING_KEYS = new Set(['canvas_data', 'mount_ref', 'canvasData', 'mountRef'])
const LEGACY_TYPE_VALUES = { batten: 'zugstange', point_batten: 'punktzug' }
const SKIP_PREFIXES = ['/api/health', '/api/operator/', '/api/tls-check']

export function rewriteLegacyPath(pathname) {
  for (const [from, to] of PATH_REWRITES) {
    if (from.test(pathname)) return pathname.replace(from, to)
  }
  return pathname
}

export function isLegacyClient(req, params = {}) {
  return !(req.headers['x-api-version'] || params.api_version)
}

export function toLegacyKey(key) {
  if (key === 'drawingPlan') return 'floorplan'
  if (key === 'drawingPlans') return 'floorplans'
  return key
    .replace('batten_nr', 'zug_nr')
    .replace('battenNr', 'zugNr')
    .replace(/(^|_)batten(s?)(?=_|$)/g, '$1bar$2')
    .replace(/^batten(s?)(?=[A-Z])/, 'bar$1')
    .replace(/([a-z])Batten(s?)(?=[A-Z]|$)/g, '$1Bar$2')
}

export function toLegacyNames(node, key = '') {
  if (Array.isArray(node)) return node.map(item => toLegacyNames(item, key))
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[toLegacyKey(k)] = toLegacyNames(v, k)
    return out
  }
  if (typeof node === 'string') {
    if (JSON_STRING_KEYS.has(key) && /^\s*[[{]/.test(node)) {
      try { return JSON.stringify(toLegacyNames(JSON.parse(node))) } catch { return node }
    }
    if (key === 'type' && node === 'batten') return 'bar'
    if (/^batten_?type$/i.test(key) && LEGACY_TYPE_VALUES[node]) return LEGACY_TYPE_VALUES[node]
  }
  return node
}

export function legacyEventName(event) {
  return LEGACY_EVENTS[event] ?? event
}

// SSE-Nachricht im Format des jeweiligen Clients (res.legacyApi wird im Router gesetzt).
export function formatEvent(res, event, data) {
  if (!res.legacyApi) return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  return `event: ${legacyEventName(event)}\ndata: ${JSON.stringify(toLegacyNames(data))}\n\n`
}

const hits = new Map()
const HOUR_MS = 3_600_000

function recordHit(req) {
  const ua = String(req.headers['user-agent'] || 'unbekannt').split(' ')[0].slice(0, 60)
  const entry = hits.get(ua) ?? { count: 0, lastLog: 0 }
  entry.count++
  if (Date.now() - entry.lastLog > HOUR_MS) {
    log.info('Alter Client', { ua, anfragen_seit_letztem_log: entry.count })
    entry.lastLog = Date.now()
    entry.count = 0
  }
  hits.set(ua, entry)
}

// Markiert die Antwort als alt und übersetzt JSON-Bodies beim Senden zurück.
export function applyLegacyResponse(req, res, pathname) {
  if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) return
  res.legacyApi = true
  recordHit(req)
  const origWriteHead = res.writeHead.bind(res)
  const origEnd = res.end.bind(res)
  let isJson = false
  res.writeHead = (status, ...rest) => {
    const headers = rest.find(h => h && typeof h === 'object' && !Array.isArray(h))
    const type = headers && (headers['Content-Type'] ?? headers['content-type'])
    isJson = typeof type === 'string' && type.includes('application/json')
    if (isJson) { delete headers['Content-Length']; delete headers['content-length'] }
    return origWriteHead(status, ...rest)
  }
  res.end = (chunk, ...args) => {
    if (isJson && typeof chunk === 'string') {
      try { chunk = JSON.stringify(toLegacyNames(JSON.parse(chunk))) } catch { /* unverändert senden */ }
    }
    return origEnd(chunk, ...args)
  }
}

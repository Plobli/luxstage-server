import { clientIp } from './helpers.js'

// Grobes globales Limit gegen Ressourcenerschöpfung (Uploads, PDF-Export, Show-Anlage
// etc.) — ergänzt das strengere, spezifische Limit auf /api/auth/login und
// /api/auth/forgot-password (siehe routes/auth.js), das dieses Modul nicht ersetzt.
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 300
const MAX_TRACKED_IPS = 10_000

const hits = new Map()

function purgeExpired() {
  const cutoff = Date.now() - WINDOW_MS
  for (const [ip, entry] of hits) {
    if (entry.firstAt <= cutoff) hits.delete(ip)
  }
}

const cleanup = setInterval(purgeExpired, WINDOW_MS)
cleanup.unref()

export function isGloballyRateLimited(req) {
  const ip = clientIp(req)
  const now = Date.now()
  const entry = hits.get(ip)

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    if (!entry && hits.size >= MAX_TRACKED_IPS) {
      hits.delete(hits.keys().next().value)
    }
    hits.set(ip, { count: 1, firstAt: now })
    return false
  }

  entry.count += 1
  return entry.count > MAX_REQUESTS
}

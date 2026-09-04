import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { getDb, getTenantId } from './db-context.js'
import { config } from './config.js'
import { randomBytes } from 'node:crypto'

// ── Kurzlebige Einmal-Token für URL-basierte Ressourcen (PDF, Fotos, Backup) ──
// Speichert: token → { username, tenantId, expiresAt }
const downloadTokens = new Map()
const DOWNLOAD_TOKEN_TTL_MS = 60 * 1000 // 60 Sekunden

export function issueDownloadToken(username, tenantId) {
  const token = randomBytes(24).toString('hex')
  downloadTokens.set(token, { username, tenantId, expiresAt: Date.now() + DOWNLOAD_TOKEN_TTL_MS })
  return token
}

// Abgelaufene Token periodisch bereinigen (verhindert Memory-Leak bei abgebrochenen Downloads).
// Der Timer darf Einmalprozesse wie Tests oder Bootstrap nicht am Beenden hindern.
const downloadTokenCleanup = setInterval(() => {
  const now = Date.now()
  for (const [token, entry] of downloadTokens) {
    if (now > entry.expiresAt) downloadTokens.delete(token)
  }
}, 60_000)
downloadTokenCleanup.unref()

function redeemDownloadToken(token) {
  const entry = downloadTokens.get(token)
  if (!entry) return null
  downloadTokens.delete(token) // Einmalnutzung
  if (Date.now() > entry.expiresAt) return null
  return entry.tenantId
    ? { username: entry.username, tenantId: entry.tenantId }
    : { username: entry.username }
}

// ── Kurzlebige, wiederverwendbare Token für Inline-Ressourcen (img src) ──────
// Anders als Download-Token nicht Einmalnutzung: dasselbe Bild wird vom
// Browser mehrfach geladen/gecached, ein Einmal-Token würde beim zweiten
// Request scheitern. Kürzere Lebensdauer als das 12h-JWT begrenzt den
// Schaden, falls die URL in Browser-History oder Proxy-Logs landet.
const inlineTokens = new Map()
const INLINE_TOKEN_TTL_MS = 15 * 60 * 1000 // 15 Minuten

export function issueInlineToken(username, tenantId) {
  const token = randomBytes(24).toString('hex')
  inlineTokens.set(token, { username, tenantId, expiresAt: Date.now() + INLINE_TOKEN_TTL_MS })
  return { token, expiresAt: Date.now() + INLINE_TOKEN_TTL_MS }
}

const inlineTokenCleanup = setInterval(() => {
  const now = Date.now()
  for (const [token, entry] of inlineTokens) {
    if (now > entry.expiresAt) inlineTokens.delete(token)
  }
}, 60_000)
inlineTokenCleanup.unref()

function verifyInlineToken(token) {
  const entry = inlineTokens.get(token)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { inlineTokens.delete(token); return null }
  return entry.tenantId
    ? { username: entry.username, tenantId: entry.tenantId }
    : { username: entry.username }
}

const BCRYPT_COST = 12

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST)
}

async function verifyPassword(plain, stored) {
  if (!stored?.startsWith('$2')) return false
  return bcrypt.compare(plain, stored)
}

export function signToken(username) {
  // Token an den aktuellen Mandanten binden (falls im Mandanten-Kontext ausgestellt).
  const tenantId = getTenantId()
  const payload = tenantId ? { username, tenantId } : { username }
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '12h' })
}

export async function login(username, password) {
  // COLLATE NOCASE: selbstregistrierte User werden mit kleingeschriebenem
  // username gespeichert (siehe createSelfRegisteredUserWithHash), Admin-eingeladene
  // ggf. nicht — Login muss beide Fälle unabhängig von der eingegebenen
  // Groß-/Kleinschreibung finden.
  const row = getDb().prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username)
  if (!row) return null
  const ok = await verifyPassword(password, row.password)
  if (!ok) return null
  if (row.pending === 1) return { pending: true }
  return {
    token: signToken(row.username),
    requiresPasswordChange: row.requires_password_change === 1,
  }
}

export function authenticate(req) {
  // 1. JWT aus Header prüfen (verhindert Token-Leak in Browser-History und Logs)
  const header = req.headers['authorization'] || ''
  if (header.startsWith('Bearer ')) {
    const jwtToken = header.slice(7)
    try { return jwt.verify(jwtToken, config.jwtSecret) } catch {}
  }

  // 2. Kurzlebige Download-Token aus URL prüfen (für SSE, PDF, Backup-URLs)
  const url = new URL(req.url, 'http://localhost')
  const downloadToken = url.searchParams.get('token')
  if (downloadToken) {
    const redeemed = redeemDownloadToken(downloadToken)
    if (redeemed) return redeemed
    const inline = verifyInlineToken(downloadToken)
    if (inline) return inline
    try { return jwt.verify(downloadToken, config.jwtSecret) } catch {}
  }

  return null
}

export function requireAuth(req, res) {
  const user = req.user ?? authenticate(req)
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Nicht angemeldet' }))
    return null
  }
  return user
}

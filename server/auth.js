import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { getDb, getTenantId } from './db-context.js'
import { config } from './config.js'
import { randomBytes } from 'node:crypto'
import { getTokenVersion } from './db/users.js'

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
  const tokenVersion = getTokenVersion(username)
  const payload = tenantId ? { username, tenantId, tokenVersion } : { username, tokenVersion }
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

// Lehnt ab, falls das Token eine ältere token_version trägt als aktuell in
// der DB hinterlegt (Passwort wurde seither geändert/zurückgesetzt) — macht
// aus setPasswordHash() einen sofortigen Session-Entzug statt dass gestohlene
// Tokens bis zu 12h weiter gültig bleiben. Tokens ohne tokenVersion-Claim
// (ausgestellt vor Einführung dieses Felds) werden wie Version 0 behandelt.
function hasCurrentTokenVersion(payload) {
  if (!payload.username) return true // Operator-Token o.ä. ohne username-Claim
  return (payload.tokenVersion ?? 0) >= getTokenVersion(payload.username)
}

export function authenticate(req) {
  // 1. JWT aus Header prüfen (verhindert Token-Leak in Browser-History und Logs)
  const header = req.headers['authorization'] || ''
  if (header.startsWith('Bearer ')) {
    const jwtToken = header.slice(7)
    try {
      const payload = jwt.verify(jwtToken, config.jwtSecret)
      if (hasCurrentTokenVersion(payload)) return payload
    } catch {}
  }

  // 2. Kurzlebige, zweckgebundene Token aus URL prüfen (für SSE, PDF, Backup-URLs).
  // Bewusst KEIN Fallback auf das volle Session-JWT hier: dieser Zweig gilt für
  // *jede* API-Route, nicht nur die Download-/PDF-/Foto-Endpunkte, für die die
  // zweckgebundenen Tokens gedacht sind — ein 12h-Session-JWT als ?token= wäre
  // unbegrenzt wiederverwendbar und liefe mit vollem API-Scope, genau die
  // Absicherungen, die issueDownloadToken/issueInlineToken bewusst herstellen.
  const url = new URL(req.url, 'http://localhost')
  const downloadToken = url.searchParams.get('token')
  if (downloadToken) {
    const redeemed = redeemDownloadToken(downloadToken)
    if (redeemed) return redeemed
    const inline = verifyInlineToken(downloadToken)
    if (inline) return inline
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

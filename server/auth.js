import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { getDb, getTenantId } from './db-context.js'
import { config } from './config.js'
import { randomBytes, timingSafeEqual } from 'node:crypto'

// ── Kurzlebige Einmal-Token für URL-basierte Ressourcen (PDF, Fotos, Backup) ──
// Speichert: token → { username, role, expiresAt }
const downloadTokens = new Map()
const DOWNLOAD_TOKEN_TTL_MS = 60 * 1000 // 60 Sekunden

export function issueDownloadToken(username, role) {
  const token = randomBytes(24).toString('hex')
  downloadTokens.set(token, { username, role, expiresAt: Date.now() + DOWNLOAD_TOKEN_TTL_MS })
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
  return { username: entry.username, role: entry.role }
}

const BCRYPT_COST = 12

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST)
}

async function verifyPassword(plain, stored) {
  // Klartext-Migration: gespeichertes Passwort ist noch kein bcrypt-Hash
  if (!stored.startsWith('$2')) {
    const a = Buffer.from(plain)
    const b = Buffer.from(stored)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false
    return true // caller must rehash
  }
  return bcrypt.compare(plain, stored)
}

export function signToken(username, role) {
  // Token an den aktuellen Mandanten binden (falls im Mandanten-Kontext ausgestellt).
  const tenantId = getTenantId()
  const payload = tenantId ? { username, role, tenantId } : { username, role }
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '72h' })
}

export async function login(username, password) {
  const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!row) return null
  const ok = await verifyPassword(password, row.password)
  if (!ok) return null
  if (!row.password.startsWith('$2')) {
    const hash = await hashPassword(password)
    getDb().prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, row.username)
  }
  return {
    token: signToken(row.username, row.role),
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

  // 2. Kurzlebige Download-Token aus URL prüfen (für SSE, PDF, Foto- und Backup-URLs)
  const url = new URL(req.url, 'http://localhost')
  const downloadToken = url.searchParams.get('token')
  if (downloadToken) {
    const redeemed = redeemDownloadToken(downloadToken)
    if (redeemed) return redeemed
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

export function requireAdmin(req, res) {
  const user = requireAuth(req, res)
  if (!user) return null
  if (user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Keine Berechtigung' }))
    return null
  }
  return user
}

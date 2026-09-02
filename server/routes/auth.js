import { randomBytes } from 'node:crypto'
import { login, signToken, requireAuth, issueDownloadToken, issueInlineToken } from '../auth.js'
import { changePassword, clearResetTokens, createResetToken, findUserByEmail, getDbPassword, takeResetToken } from '../db/users.js'
import { readJsonBody, json, clientIp } from '../helpers.js'
import { sendPasswordResetLink, isSmtpConfigured } from '../email.js'
import { getTenantId } from '../db-context.js'
import { config } from '../config.js'
import { PASSWORD_MIN_LENGTH } from '../../shared/constants.js'

const loginAttempts = new Map()
const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_TRACKED_IPS = 10_000

function purgeExpiredAttempts() {
  const cutoff = Date.now() - LOGIN_WINDOW_MS
  for (const [ip, entry] of loginAttempts) {
    if (entry.firstAt <= cutoff) loginAttempts.delete(ip)
  }
}

const attemptCleanup = setInterval(purgeExpiredAttempts, LOGIN_WINDOW_MS)
attemptCleanup.unref()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry) return false
  if (now - entry.firstAt > LOGIN_WINDOW_MS) { loginAttempts.delete(ip); return false }
  return entry.count >= MAX_LOGIN_ATTEMPTS
}

function recordFailedLogin(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    if (!entry && loginAttempts.size >= MAX_TRACKED_IPS) {
      loginAttempts.delete(loginAttempts.keys().next().value)
    }
    loginAttempts.set(ip, { count: 1, firstAt: now })
  } else {
    loginAttempts.set(ip, { ...entry, count: entry.count + 1 })
  }
}

export async function authRoutes(req, res, pathname) {
  const { method } = req

  // Öffentlich: die Login-Seite muss vor der Anmeldung wissen, ob der
  // Self-Service-Reset überhaupt möglich ist (ohne SMTP wird nie eine Mail
  // zugestellt). Bewusst getrennt von /api/status, das dataPath und diskFree
  // preisgibt und deshalb Auth verlangt.
  if (method === 'GET' && pathname === '/api/auth/capabilities') {
    return json(res, 200, { passwordReset: isSmtpConfigured() })
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const ip = clientIp(req)
    if (isRateLimited(ip)) return json(res, 429, { error: 'Zu viele Versuche. Bitte warten.' })
    const body = await readJsonBody(req, res); if (body === null) return
    const { username, password } = body
    const loginResult = await login(username, password)
    if (!loginResult) {
      recordFailedLogin(ip)
      console.log(`[auth] fehlgeschlagener Login: user=${username} ip=${ip}`)
      return json(res, 401, { error: 'Ungültige Anmeldedaten' })
    }
    if (loginResult.pending) {
      console.log(`[auth] Login blockiert (pending): user=${username} ip=${ip}`)
      return json(res, 403, { error: 'pending', message: 'Konto wartet auf Freischaltung durch ein Teammitglied' })
    }
    console.log(`[auth] Login erfolgreich: user=${username} ip=${ip}`)
    return json(res, 200, loginResult)
  }

  if (method === 'POST' && pathname === '/api/auth/refresh') {
    const user = req.user
    return json(res, 200, { token: signToken(user.username) })
  }

  if (method === 'POST' && pathname === '/api/auth/download-token') {
    const user = req.user
    return json(res, 200, { token: issueDownloadToken(user.username, user.tenantId) })
  }

  if (method === 'POST' && pathname === '/api/auth/inline-token') {
    const user = req.user
    return json(res, 200, issueInlineToken(user.username, user.tenantId))
  }

  if (method === 'POST' && pathname === '/api/auth/change-password') {
    const user = req.user
    const body = await readJsonBody(req, res); if (body === null) return
    const { currentPassword, newPassword } = body
    if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) return json(res, 400, { error: `Passwort zu kurz (min. ${PASSWORD_MIN_LENGTH} Zeichen)` })
    const storedPassword = getDbPassword(user.username)
    const pwOk = !!storedPassword?.startsWith('$2')
      && await (await import('bcrypt')).compare(currentPassword, storedPassword)
    if (!pwOk) return json(res, 403, { error: 'Aktuelles Passwort falsch' })
    await changePassword(user.username, newPassword, 0)
    return json(res, 200, { ok: true })
  }

  // Self-Service: Passwort-Reset anfordern (öffentlich, im Mandanten-Kontext).
  if (method === 'POST' && pathname === '/api/auth/forgot-password') {
    const ip = clientIp(req)
    if (isRateLimited(ip)) return json(res, 429, { error: 'Zu viele Versuche. Bitte warten.' })
    const body = await readJsonBody(req, res); if (body === null) return
    const email = String(body.email || '').trim()
    const username = email ? findUserByEmail(email) : null
    if (username) {
      clearResetTokens(username)
      const token = randomBytes(32).toString('hex')
      createResetToken(token, username, 60 * 60 * 1000) // 1 h
      const tenantId = getTenantId()
      const baseUrl = config.baseDomain ? `https://${tenantId}.${config.baseDomain}` : config.appUrl
      const resetUrl = `${baseUrl}/reset-password?token=${token}`
      sendPasswordResetLink(email, username, resetUrl)
        .catch(err => console.error('[email] Reset-Link fehlgeschlagen:', err))
      console.log(`[auth] Reset angefordert: user=${username} ip=${ip}`)
    } else {
      recordFailedLogin(ip) // bremst Enumeration
    }
    // Immer neutrale Antwort — kein Leak, ob die E-Mail existiert.
    return json(res, 200, { ok: true, message: 'Falls die E-Mail existiert, wurde ein Link versendet.' })
  }

  // Self-Service: neues Passwort mit Reset-Token setzen (öffentlich).
  if (method === 'POST' && pathname === '/api/auth/reset-password/confirm') {
    const body = await readJsonBody(req, res); if (body === null) return
    const token = String(body.token || '')
    const newPassword = String(body.newPassword || '')
    if (newPassword.length < PASSWORD_MIN_LENGTH) return json(res, 400, { error: `Passwort zu kurz (min. ${PASSWORD_MIN_LENGTH} Zeichen)` })
    const username = takeResetToken(token)
    if (!username) return json(res, 400, { error: 'Link ungültig oder abgelaufen' })
    await changePassword(username, newPassword, 0)
    console.log(`[auth] Passwort zurückgesetzt: user=${username}`)
    return json(res, 200, { ok: true })
  }

  return null
}

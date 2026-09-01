import { randomBytes } from 'node:crypto'
import * as db from '../db.js'
import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { sendWelcomeEmail, sendApprovalRequestEmail, sendPendingRegistrationEmail } from '../email.js'
import { PASSWORD_MIN_LENGTH, isValidEmail } from '../../shared/constants.js'

const USER_ID = /^\/api\/users\/([^/]+)$/
const APPROVE_USER = /^\/api\/users\/([^/]+)\/approve$/

export async function userRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'GET' && pathname === '/api/me/preferences') {
    const user = requireAuth(req, res); if (!user) return
    return json(res, 200, db.getUserPreferences(user.username))
  }

  if (method === 'PATCH' && pathname === '/api/me/preferences') {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    db.setUserPreferences(user.username, body)
    return json(res, 200, { ok: true })
  }

  if (method === 'GET' && pathname === '/api/me/griddeck') {
    const user = requireAuth(req, res); if (!user) return
    const config = db.getGridDeckConfig(user.username)
    return json(res, 200, config ?? {})
  }

  if (method === 'PUT' && pathname === '/api/me/griddeck') {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    db.setGridDeckConfig(user.username, body)
    return json(res, 200, { ok: true })
  }

  if (method === 'GET' && pathname === '/api/users') {
    const user = requireAuth(req, res); if (!user) return
    return json(res, 200, db.listUsers())
  }

  if (method === 'POST' && pathname === '/api/users') {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { username } = body
    if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return json(res, 400, { error: 'Ungültige E-Mail-Adresse' })
    const password = randomBytes(12).toString('hex')
    await db.createUser(username, password, username)
    sendWelcomeEmail(username, username, password).catch(err => console.error('[email] Willkommens-Email fehlgeschlagen:', err))
    console.log(`[users] angelegt: user=${username} von=${user.username}`)
    return json(res, 201, { ok: true })
  }

  // Selbst-Registrierung: öffentlich, läuft aber bereits im Tenant-DB-Kontext
  // (Subdomain-Routing hat die passende Tenant-DB gebunden). Neuer Nutzer
  // startet als pending — kein Login möglich, bis ein bestehender Nutzer freischaltet.
  if (method === 'POST' && pathname === '/api/self-register') {
    const body = await readJsonBody(req, res); if (body === null) return
    const email = String(body.email || '').trim()
    const password = String(body.password || '')
    if (!isValidEmail(email)) return json(res, 400, { error: 'Ungültige E-Mail-Adresse' })
    if (password.length < PASSWORD_MIN_LENGTH) return json(res, 400, { error: `Passwort zu kurz (min. ${PASSWORD_MIN_LENGTH} Zeichen)` })
    if (db.findUserByEmail(email)) return json(res, 409, { error: 'E-Mail-Adresse bereits registriert' })

    // Reiner INSERT ohne UPSERT: schlägt bei Username-Konflikt hart fehl statt
    // bestehende Zugangsdaten zu überschreiben (kein Account-Takeover über
    // diesen öffentlichen Endpoint, auch nicht bei Race mit dem Check oben).
    try {
      await db.createSelfRegisteredUser(email, password, email)
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return json(res, 409, { error: 'E-Mail-Adresse bereits registriert' })
      throw err
    }
    console.log(`[users] Selbst-Registrierung: user=${email}`)

    sendPendingRegistrationEmail(email).catch(err => console.error('[email] Pending-Mail fehlgeschlagen:', err))
    const approverEmails = db.listUsers().filter(u => u.email && !u.pending).map(u => u.email)
    if (approverEmails.length) {
      sendApprovalRequestEmail(approverEmails, email).catch(err => console.error('[email] Freischalt-Anfrage fehlgeschlagen:', err))
    }

    return json(res, 202, { ok: true, message: 'Registrierung eingegangen, wartet auf Freischaltung' })
  }

  let m
  if (method === 'POST' && (m = APPROVE_USER.exec(pathname))) {
    const user = requireAuth(req, res); if (!user) return
    const username = m[1]
    db.approveUser(username)
    console.log(`[users] freigeschaltet: user=${username} von=${user.username}`)
    return json(res, 200, { ok: true })
  }

  if (method === 'DELETE' && (m = USER_ID.exec(pathname))) {
    const user = requireAuth(req, res); if (!user) return
    const username = m[1]
    if (username === user.username) return json(res, 400, { error: 'Eigenen Account kann man nicht löschen' })
    db.deleteUser(username)
    console.log(`[users] gelöscht: user=${username} von=${user.username}`)
    return json(res, 200, { ok: true })
  }

  return null
}

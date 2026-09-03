import { randomBytes } from 'node:crypto'
import { approveUser, createSelfRegisteredUser, createUser, deleteUser, findUserByEmail, getGridDeckConfig, getUserPreferences, listUsers, setGridDeckConfig, setUserPreferences } from '../db/users.js'
import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { sendWelcomeEmail, sendApprovalRequestEmail, sendPendingRegistrationEmail } from '../email.js'
import { PASSWORD_MIN_LENGTH, isValidEmail } from '../../shared/constants.js'
import { logger } from '../logger.js'

const log = logger('users')

const USER_ID = /^\/api\/users\/([^/]+)$/
const APPROVE_USER = /^\/api\/users\/([^/]+)\/approve$/

export async function userRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'GET' && pathname === '/api/me/preferences') {
    const user = requireAuth(req, res); if (!user) return
    return json(res, 200, getUserPreferences(user.username))
  }

  if (method === 'PATCH' && pathname === '/api/me/preferences') {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    setUserPreferences(user.username, body)
    return json(res, 200, { ok: true })
  }

  if (method === 'GET' && pathname === '/api/me/griddeck') {
    const user = requireAuth(req, res); if (!user) return
    const config = getGridDeckConfig(user.username)
    return json(res, 200, config ?? {})
  }

  if (method === 'PUT' && pathname === '/api/me/griddeck') {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    setGridDeckConfig(user.username, body)
    return json(res, 200, { ok: true })
  }

  if (method === 'GET' && pathname === '/api/users') {
    const user = requireAuth(req, res); if (!user) return
    return json(res, 200, listUsers())
  }

  if (method === 'POST' && pathname === '/api/users') {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { username } = body
    if (!username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return json(res, 400, { error: 'Ungültige E-Mail-Adresse' })
    const password = randomBytes(12).toString('hex')
    await createUser(username, password, username)
    sendWelcomeEmail(username, username, password).catch(err => log.error('Willkommens-Mail fehlgeschlagen', { user: username, fehler: err.message }))
    log.warn('Nutzer angelegt', { user: username, von: user.username })
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
    if (findUserByEmail(email)) return json(res, 409, { error: 'E-Mail-Adresse bereits registriert' })

    // Reiner INSERT ohne UPSERT: schlägt bei Username-Konflikt hart fehl statt
    // bestehende Zugangsdaten zu überschreiben (kein Account-Takeover über
    // diesen öffentlichen Endpoint, auch nicht bei Race mit dem Check oben).
    try {
      await createSelfRegisteredUser(email, password, email)
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return json(res, 409, { error: 'E-Mail-Adresse bereits registriert' })
      throw err
    }
    log.warn('Selbst-Registrierung', { user: email })

    sendPendingRegistrationEmail(email).catch(err => log.error('Pending-Mail fehlgeschlagen', { user: email, fehler: err.message }))
    const approverEmails = listUsers().filter(u => u.email && !u.pending).map(u => u.email)
    if (approverEmails.length) {
      sendApprovalRequestEmail(approverEmails, email).catch(err => log.error('Freischalt-Anfrage fehlgeschlagen', { user: email, fehler: err.message }))
    }

    return json(res, 202, { ok: true, message: 'Registrierung eingegangen, wartet auf Freischaltung' })
  }

  let m
  if (method === 'POST' && (m = APPROVE_USER.exec(pathname))) {
    const user = requireAuth(req, res); if (!user) return
    const username = m[1]
    approveUser(username)
    log.warn('Nutzer freigeschaltet', { user: username, von: user.username })
    return json(res, 200, { ok: true })
  }

  if (method === 'DELETE' && (m = USER_ID.exec(pathname))) {
    const user = requireAuth(req, res); if (!user) return
    const username = m[1]
    if (username === user.username) return json(res, 400, { error: 'Eigenen Account kann man nicht löschen' })
    deleteUser(username)
    log.warn('Nutzer gelöscht', { user: username, von: user.username })
    return json(res, 200, { ok: true })
  }

  return null
}

import { randomBytes } from 'node:crypto'
import * as db from '../db.js'
import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { sendWelcomeEmail } from '../email.js'

const USER_ID = /^\/api\/users\/([^/]+)$/

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

  let m
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

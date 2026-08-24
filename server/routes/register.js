// LuxStage/server/routes/register.js
// Self-Service-Registrierung mit Doppel-Opt-In.
//  POST /api/register          -> pending anlegen + Bestätigungsmail
//  GET  /api/register/confirm  -> Mandant + ersten Admin erzeugen
//
// Läuft im öffentlichen Kontext (keine Mandanten-DB): Anmeldedaten leben bis zur
// Bestätigung in der Registry-DB. Erst confirm legt Mandanten-DB + Admin an —
// nie ein vorangelegter User.
import { randomBytes } from 'node:crypto'
import { json, readJsonBody } from '../helpers.js'
import { hashPassword } from '../auth.js'
import { config } from '../config.js'
import { isValidTenantId, createTenant, deleteTenant, tenantExists } from '../tenants.js'
import { isReservedSubdomain, tenantBaseUrl } from '../tenant-resolve.js'
import { getRegistry, tenantIdTaken, emailTaken, addPending, getPending, confirmPending, hasPendingForTenant } from '../registry.js'
import { runWithDb } from '../db-context.js'
import { sendConfirmEmail } from '../email.js'
import { PASSWORD_MIN_LENGTH } from '../../shared/constants.js'

export const CONFIRM_TTL_MS = 24 * 60 * 60 * 1000 // 24 h
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function registerRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'POST' && pathname === '/api/register') {
    const body = await readJsonBody(req, res); if (body === null) return
    const tenantId = String(body.teamId || '').toLowerCase().trim()
    const email = String(body.email || '').trim()
    const password = String(body.password || '')

    if (!isValidTenantId(tenantId)) return json(res, 400, { error: 'Ungültiges Team-Kürzel (nur a-z, 0-9, Bindestrich)' })
    if (isReservedSubdomain(tenantId)) return json(res, 409, { error: 'Dieses Team-Kürzel ist reserviert' })
    if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'Ungültige E-Mail-Adresse' })
    if (password.length < PASSWORD_MIN_LENGTH) return json(res, 400, { error: `Passwort zu kurz (min. ${PASSWORD_MIN_LENGTH} Zeichen)` })

    // Konflikte: Subdomain schon vergeben, offene Anmeldung dafür läuft, oder
    // E-Mail schon Admin eines Mandanten. Der pending-Check verhindert, dass
    // mehrere Anmeldungen dieselbe Subdomain belegen und sich gegenseitig kapern.
    if (tenantIdTaken(tenantId) || tenantExists(tenantId) || hasPendingForTenant(tenantId)) {
      return json(res, 409, { error: 'Team-Kürzel bereits vergeben' })
    }
    if (emailTaken(email)) {
      return json(res, 409, { error: 'E-Mail-Adresse bereits registriert' })
    }

    const token = randomBytes(32).toString('hex')
    const passwordHash = await hashPassword(password)
    addPending({ token, tenantId, email, passwordHash, ttlMs: CONFIRM_TTL_MS })

    // Bestätigung läuft auf der Root-Domain — der Mandant existiert noch nicht,
    // seine Subdomain würde 404 liefern.
    const confirmUrl = `${config.appUrl}/register/confirm?token=${token}`
    sendConfirmEmail(email, tenantId, confirmUrl)
      .catch(err => console.error('[register] Bestätigungsmail fehlgeschlagen:', err))

    console.log(`[register] pending: team=${tenantId} email=${email}`)
    // Bewusst neutrale Antwort — kein Leak, ob Team/Mail existiert.
    return json(res, 202, { ok: true, message: 'Bitte E-Mail bestätigen.' })
  }

  if (method === 'GET' && pathname === '/api/register/confirm') {
    const url = new URL(req.url, 'http://localhost')
    const token = url.searchParams.get('token') || ''
    const row = getPending(token)
    if (!row) return json(res, 400, { error: 'Bestätigungslink ungültig oder abgelaufen' })

    // Race/Doppelklick: Mandant könnte seit dem pending-Eintrag entstanden sein.
    if (tenantIdTaken(row.tenant_id) || tenantExists(row.tenant_id)) {
      return json(res, 409, { error: 'Team-Kürzel inzwischen vergeben' })
    }

    let tenantCreated = false
    try {
      // Der Token bleibt gültig, bis Tenant-DB, erster Nutzer und Registry-Commit
      // vollständig gelungen sind. Jeder Fehler räumt die vorbereitete DB weg.
      const tdb = createTenant(row.tenant_id)
      tenantCreated = true
      runWithDb(tdb, () => {
        tdb.prepare(
          'INSERT INTO users (username, password, email, requires_password_change) VALUES (?, ?, ?, 0)'
        ).run(row.email, row.password_hash, row.email)
      })
      if (!confirmPending(token, row.tenant_id, row.email)) {
        throw new Error('Bestätigung wurde parallel verarbeitet')
      }
    } catch (err) {
      if (tenantCreated) deleteTenant(row.tenant_id)
      console.error(`[register] Bestätigung fehlgeschlagen: team=${row.tenant_id}`, err)
      return json(res, 409, { error: 'Bestätigungslink wurde bereits verarbeitet. Bitte erneut versuchen.' })
    }

    console.log(`[register] bestätigt: team=${row.tenant_id} email=${row.email}`)
    return json(res, 200, { ok: true, tenantId: row.tenant_id, loginUrl: tenantBaseUrl(row.tenant_id) })
  }

  return null
}

// Registry-DB beim Import initialisieren, damit sie im öffentlichen Kontext bereitsteht.
getRegistry()

// LuxStage/server/routes/tenant-delete.js
// Self-Service-Löschanfrage für den eigenen Mandanten (nur SaaS-Betrieb).
//   POST /api/tenant/delete-request  -> Passwort prüfen, Betreiber per Mail benachrichtigen (auth)
//
// Bewusst KEINE automatisierte Löschung: der Mandant wird nur zur Löschung
// vorgemerkt, der Betreiber prüft die Anfrage und löscht manuell über das
// Betreiber-Panel (DELETE /api/operator/tenants/:id, siehe routes/operator.js).
import { json, readJsonBody } from '../helpers.js'
import { requireAuth, login } from '../auth.js'
import { getTenantId } from '../db-context.js'
import { getUserEmail } from '../db/users.js'
import { sendTenantDeleteRequestEmail } from '../email.js'
import { config } from '../config.js'
import { logger } from '../logger.js'

const log = logger('tenant-delete')

export async function tenantDeleteRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'POST' && pathname === '/api/tenant/delete-request') {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    const password = String(body.password || '')

    const loginResult = await login(user.username, password)
    if (!loginResult || loginResult.pending) {
      return json(res, 401, { error: 'Passwort falsch' })
    }

    const tenantId = getTenantId()
    const email = getUserEmail(user.username) || user.username

    if (config.operator.notifyEmail) {
      sendTenantDeleteRequestEmail(config.operator.notifyEmail, tenantId, email)
        .catch(err => log.error('Lösch-Anfragemail fehlgeschlagen', { tenant: tenantId, fehler: err.message }))
    } else {
      log.error('Löschanfrage ohne konfigurierten Betreiber-Kontakt (OPERATOR_NOTIFY_EMAIL fehlt)', { tenant: tenantId })
    }

    log.warn('Löschung angefordert', { tenant: tenantId, user: user.username })
    return json(res, 202, { ok: true, message: 'Anfrage gesendet. Wir melden uns bei dir oder löschen euer Team.' })
  }

  return null
}

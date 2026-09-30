// LuxStage/server/routes/feedback.js
// Feedback aus der WebApp (nur SaaS-Betrieb).
//   POST /api/feedback  { text }  -> in Registry speichern (auth, Rate-Limit)
//
// Der Betreiber holt neue Einträge über GET /api/operator/feedback (routes/operator.js).
import { json, readJsonBody } from '../helpers.js'
import { requireAuth } from '../auth.js'
import { getTenantId } from '../db-context.js'
import { addFeedback } from '../registry.js'
import { sendFeedbackEmail } from '../email.js'
import { config } from '../config.js'
import { logger } from '../logger.js'

const log = logger('feedback')

export const FEEDBACK_MAX_LENGTH = 4000
const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_MAX = 5

// Pro Mandant+Nutzer, im Speicher (Neustart setzt zurück — genügt gegen Spam).
const sent = new Map()

function isRateLimited(key) {
  const cutoff = Date.now() - RATE_WINDOW_MS
  const recent = (sent.get(key) || []).filter(ts => ts > cutoff)
  if (recent.length >= RATE_MAX) { sent.set(key, recent); return true }
  recent.push(Date.now())
  sent.set(key, recent)
  return false
}

export async function feedbackRoutes(req, res, pathname) {
  if (req.method === 'POST' && pathname === '/api/feedback') {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    const text = String(body.text ?? '').trim()
    if (!text) return json(res, 400, { error: 'Text fehlt' })
    if (text.length > FEEDBACK_MAX_LENGTH) {
      return json(res, 400, { error: `Text zu lang (max. ${FEEDBACK_MAX_LENGTH} Zeichen)` })
    }

    const tenantId = getTenantId()
    if (isRateLimited(`${tenantId}:${user.username}`)) {
      return json(res, 429, { error: 'Zu viel Feedback in kurzer Zeit. Bitte später erneut versuchen.' })
    }

    const id = addFeedback({ tenantId, username: user.username, text })
    log.info('Feedback erhalten', { tenant: tenantId, user: user.username, id })

    if (config.operator.notifyEmail) {
      sendFeedbackEmail(config.operator.notifyEmail, tenantId, user.username, text)
        .catch(err => log.error('Feedback-Mail fehlgeschlagen', { tenant: tenantId, fehler: err.message }))
    }
    return json(res, 201, { ok: true })
  }
  return null
}

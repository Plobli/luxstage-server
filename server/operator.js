// LuxStage/server/operator.js
// Betreiber-Zugang für das Verwaltungs-Panel (admin.<baseDomain>).
// Vollständig getrennt von der Mandanten-Auth: eigener Login gegen ENV-Credentials,
// eigener Token-Claim (scope: 'operator'). Ein Mandanten-JWT gilt hier NICHT.
import jwt from 'jsonwebtoken'
import { timingSafeEqual } from 'node:crypto'
import { config } from './config.js'
import { clientIp } from './helpers.js'
import { logger } from './logger.js'

const log = logger('operator')

// Panel ist nur aktiv, wenn ein Passwort gesetzt ist (kein vorangelegter Zugang).
export function operatorEnabled() {
  return config.operator.password.length > 0
}

function safeEqual(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

// Prüft Betreiber-Credentials, gibt bei Erfolg einen scope='operator'-Token zurück.
export function operatorLogin(username, password) {
  if (!operatorEnabled()) return null
  if (!safeEqual(username, config.operator.user)) return null
  if (!safeEqual(password, config.operator.password)) return null
  const token = jwt.sign({ scope: 'operator', username }, config.jwtSecret, { expiresIn: '12h' })
  return { token }
}

// Guard für Betreiber-Routen: verlangt einen gültigen scope='operator'-Token.
// Höchstprivilegierte Credential im System (ein geteiltes ENV-Secret, das
// Tenant-Löschung/-Suspendierung/DB-Restore für jeden Mandanten schützt) —
// jede Ablehnung wird geloggt, damit ein sondierter/kompromittierter Zugang
// nachträglich untersuchbar ist.
export function requireOperator(req, res) {
  const header = req.headers['authorization'] || ''
  if (header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret)
      if (payload.scope === 'operator') return payload
      log.warn('Betreiber-Token mit falschem Scope abgelehnt', { ip: clientIp(req) })
    } catch {
      log.warn('Betreiber-Token ungültig oder abgelaufen', { ip: clientIp(req) })
    }
  } else {
    log.warn('Betreiber-Route ohne Token aufgerufen', { ip: clientIp(req) })
  }
  res.writeHead(401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Betreiber-Anmeldung erforderlich' }))
  return null
}

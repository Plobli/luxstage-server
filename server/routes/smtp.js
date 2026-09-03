import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { getSettingsByPrefix, setSetting, getSecretSetting, setSecretSetting } from '../db/settings.js'
import { config } from '../config.js'
import { sendTestEmail } from '../email.js'

function getSmtpConfig() {
  const rows = getSettingsByPrefix('smtp.')
  const cfg = { host: '', port: '587', secure: false, user: '', pass: '', from: '' }
  for (const { key, value } of rows) {
    const k = key.replace('smtp.', '')
    if (k === 'pass') continue
    cfg[k] = k === 'secure' ? value === 'true' : value
  }
  cfg.pass = getSecretSetting('smtp.pass')
  return cfg
}

function saveSmtpConfig(cfg) {
  for (const field of ['host', 'port', 'secure', 'user', 'from']) {
    setSetting(`smtp.${field}`, String(cfg[field] ?? ''))
  }
  // Leeres Feld heißt "unverändert" — die UI sendet das Passwort nur, wenn es neu gesetzt wird.
  if (cfg.pass) setSecretSetting('smtp.pass', String(cfg.pass))
}

export async function smtpRoutes(req, res, pathname) {
  const { method } = req

  // Im SaaS-Modus ist SMTP zentral (Betreiber) — Mandanten können es nicht konfigurieren.
  if (config.baseDomain && (pathname === '/api/smtp')) {
    const admin = requireAuth(req, res); if (!admin) return
    if (method === 'GET') return json(res, 200, { managed: true })
    if (method === 'POST') return json(res, 403, { error: 'SMTP wird zentral verwaltet' })
  }

  if (method === 'GET' && pathname === '/api/smtp') {
    const admin = requireAuth(req, res); if (!admin) return
    const cfg = getSmtpConfig()
    return json(res, 200, { ...cfg, pass: cfg.pass ? '••••••••' : '' })
  }

  if (method === 'POST' && pathname === '/api/smtp') {
    const admin = requireAuth(req, res); if (!admin) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { host, port, secure, user, pass, from } = body
    if (pass === null) setSecretSetting('smtp.pass', '')
    if (host !== undefined) saveSmtpConfig({ host, port: port || '587', secure: !!secure, user: user || '', pass: pass || '', from: from || '' })
    return json(res, 200, { ok: true })
  }

  if (method === 'POST' && pathname === '/api/smtp/test') {
    const admin = requireAuth(req, res); if (!admin) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { to } = body
    if (!to) return json(res, 400, { error: 'Empfänger fehlt' })
    try {
      await sendTestEmail(to, getSmtpConfig())
      return json(res, 200, { ok: true })
    } catch (err) {
      // err.message (Nodemailer) kann SMTP-Host/Port/Auth-Details enthalten — nicht an
      // den Client durchreichen, nur serverseitig loggen.
      console.error('[smtp] Test-Mail fehlgeschlagen:', err)
      return json(res, 502, { error: 'Test-Mail konnte nicht gesendet werden. Bitte SMTP-Einstellungen prüfen.' })
    }
  }

  return null
}

import { requireAdmin } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { getSettingsByPrefix, setSetting } from '../db/settings.js'
import { config } from '../config.js'
import { sendTestEmail } from '../email.js'

function getSmtpConfig() {
  const rows = getSettingsByPrefix('smtp.')
  const cfg = { host: '', port: '587', secure: false, user: '', pass: '', from: '' }
  for (const { key, value } of rows) {
    const k = key.replace('smtp.', '')
    cfg[k] = k === 'secure' ? value === 'true' : (k === 'port' ? value : value)
  }
  return cfg
}

function saveSmtpConfig(cfg) {
  const fields = ['host', 'port', 'secure', 'user', 'pass', 'from']
  for (const field of fields) {
    setSetting(`smtp.${field}`, String(cfg[field] ?? ''))
  }
}

export async function smtpRoutes(req, res, pathname) {
  const { method } = req

  // Im SaaS-Modus ist SMTP zentral (Betreiber) — Mandanten können es nicht konfigurieren.
  if (config.baseDomain && (pathname === '/api/smtp')) {
    const admin = requireAdmin(req, res); if (!admin) return
    if (method === 'GET') return json(res, 200, { managed: true })
    if (method === 'POST') return json(res, 403, { error: 'SMTP wird zentral verwaltet' })
  }

  if (method === 'GET' && pathname === '/api/smtp') {
    const admin = requireAdmin(req, res); if (!admin) return
    const cfg = getSmtpConfig()
    return json(res, 200, { ...cfg, pass: cfg.pass ? '••••••••' : '' })
  }

  if (method === 'POST' && pathname === '/api/smtp') {
    const admin = requireAdmin(req, res); if (!admin) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { host, port, secure, user, pass, from } = body
    if (host !== undefined) saveSmtpConfig({ host, port: port || '587', secure: !!secure, user: user || '', pass: pass || '', from: from || '' })
    return json(res, 200, { ok: true })
  }

  if (method === 'POST' && pathname === '/api/smtp/test') {
    const admin = requireAdmin(req, res); if (!admin) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { to } = body
    if (!to) return json(res, 400, { error: 'Empfänger fehlt' })
    try {
      await sendTestEmail(to, getSmtpConfig())
      return json(res, 200, { ok: true })
    } catch (err) {
      return json(res, 500, { error: err.message })
    }
  }

  return null
}

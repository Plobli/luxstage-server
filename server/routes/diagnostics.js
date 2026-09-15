import { readJsonBody, json, clientIp } from '../helpers.js'
import { requireAuth } from '../auth.js'
import { createLoginRateLimiter } from '../login-rate-limit.js'
import { getDb } from '../db-context.js'

const { isRateLimited, recordFailedAttempt } = createLoginRateLimiter({ maxAttempts: 50, windowMs: 60 * 1000 })

export async function diagnosticsRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'POST' && pathname === '/api/diagnostics') {
    const ip = clientIp(req)
    if (isRateLimited(ip)) return json(res, 429, { error: 'Zu viele Anfragen. Bitte warten.' })

    const body = await readJsonBody(req, res); if (body === null) return

    const { platform, app_version, build_number, os_version, device_model, report_type, payload } = body

    if (!platform || !['ios', 'android'].includes(platform)) {
      recordFailedAttempt(ip)
      return json(res, 400, { error: 'platform muss "ios" oder "android" sein' })
    }

    if (!report_type) {
      recordFailedAttempt(ip)
      return json(res, 400, { error: 'report_type erforderlich' })
    }

    if (!payload) {
      recordFailedAttempt(ip)
      return json(res, 400, { error: 'payload erforderlich' })
    }

    try {
      const db = getDb()
      const stmt = db.prepare(`
        INSERT INTO diagnostics_reports (platform, app_version, build_number, os_version, device_model, report_type, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const result = stmt.run(platform, app_version || null, build_number || null, os_version || null, device_model || null, report_type, typeof payload === 'string' ? payload : JSON.stringify(payload))
      return json(res, 201, { ok: true, id: result.lastInsertRowid })
    } catch (err) {
      return json(res, 500, { error: 'Fehler beim Speichern des Berichts' })
    }
  }

  if (method === 'GET' && pathname === '/api/diagnostics') {
    const user = requireAuth(req, res); if (!user) return

    const { platform, report_type, since } = Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || ''))
    const limit = Math.min(parseInt(new URLSearchParams(req.url.split('?')[1] || '').get('limit') || '100', 10), 1000)

    try {
      const db = getDb()
      let query = 'SELECT id, platform, app_version, build_number, os_version, device_model, report_type, payload, created_at FROM diagnostics_reports WHERE 1=1'
      const params = []

      if (platform && ['ios', 'android'].includes(platform)) {
        query += ' AND platform = ?'
        params.push(platform)
      }

      if (report_type) {
        query += ' AND report_type = ?'
        params.push(report_type)
      }

      if (since) {
        const sinceMs = parseInt(since, 10)
        if (!isNaN(sinceMs)) {
          query += ' AND created_at >= ?'
          params.push(sinceMs)
        }
      }

      query += ' ORDER BY created_at DESC LIMIT ?'
      params.push(limit)

      const stmt = db.prepare(query)
      const reports = stmt.all(...params)

      return json(res, 200, { reports })
    } catch (err) {
      return json(res, 500, { error: 'Fehler beim Abrufen der Berichte' })
    }
  }

  return null
}

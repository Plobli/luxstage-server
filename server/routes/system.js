import { readFileSync } from 'node:fs'
import { requireAuth } from '../auth.js'
import { json } from '../helpers.js'
import { streamBackup, restoreBackup } from '../backup.js'
import { config } from '../config.js'
import { execSync } from 'node:child_process'

let version
;({ version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url))))
try {
  const buildNum = execSync('git rev-list --count HEAD', { stdio: 'pipe' }).toString().trim()
  version = `${version} Build ${buildNum}`
} catch {
  // Bei einem Prod-Release fehlt der .git Ordner im ZIP, daher wird der Catch-Block erreicht
  // und die Version bleibt wie in der package.json definiert (z.B. "2026.4.1").
}
export { version }

export async function systemRoutes(req, res, pathname) {
  const { method } = req

  if (method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true })
  }

  // Caddy On-Demand-TLS ask-Endpoint: 200 nur für bekannte Domains, sonst 403.
  // Nur im SaaS-Modus erreichbar (Router-gated); isKnownDomain dynamisch geladen.
  if (method === 'GET' && pathname === '/api/tls-check') {
    const url = new URL(req.url, 'http://localhost')
    const domain = url.searchParams.get('domain') || ''
    const { isKnownDomain } = await import('../tenant-resolve.js')
    if (isKnownDomain(domain)) return json(res, 200, { ok: true })
    return json(res, 403, { error: 'unbekannte Domain' })
  }

  if (method === 'GET' && pathname === '/api/status') {
    const { execFileSync } = await import('node:child_process')
    let diskFree = null
    try { diskFree = execFileSync('df', ['-h', config.dataPath]).toString().split('\n')[1] } catch {}
    return json(res, 200, { version, dataPath: config.dataPath, diskFree, saasEnabled: !!config.baseDomain })
  }

  // System-Backup/Restore ist Single-Tenant (globale DB, Prozess-Neustart).
  // Im SaaS gesperrt — Backups laufen zentral pro Mandant über das Betreiber-Panel.
  if (method === 'GET' && pathname === '/api/backup') {
    const user = requireAuth(req, res); if (!user) return
    if (config.baseDomain) return json(res, 403, { error: 'Backups werden zentral verwaltet' })
    streamBackup(res)
    return
  }

  if (method === 'POST' && pathname === '/api/restore') {
    const user = requireAuth(req, res); if (!user) return
    if (config.baseDomain) return json(res, 403, { error: 'Restore wird zentral verwaltet' })
    restoreBackup(req, res)
    return
  }

  return null
}

import { requireAuth } from '../auth.js'
import { json } from '../helpers.js'
import { config } from '../config.js'
import { version } from '../version.js'

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
    return json(res, 200, { version, dataPath: config.dataPath, diskFree })
  }

  return null
}

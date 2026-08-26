import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { parseUrl, notFound, json } from './helpers.js'
import { authenticate } from './auth.js'
import { getTenantId } from './db-context.js'
import { saasEnabled, getSaas } from './saas.js'
import { PUBLIC_ROUTES, API_ROUTE_HANDLERS, SHOW_ROUTE_HANDLERS, showRoutes, systemRoutes } from './route-table.js'
import { getLock } from './db/locks.js'
import { isGloballyRateLimited } from './rate-limit.js'

const WRITE_METHODS = new Set(['PUT', 'POST', 'DELETE'])
// Reine Show-Ressource, kein Slug-Pfad (Liste/Anlegen) oder Endpunkte, die
// unabhängig vom Schreib-Lock funktionieren müssen (Lock selbst, SSE-Subscription,
// History-Restore hat einen eigenen, engeren Lock-Check in history.js).
const SHOW_WRITE_PATH = /^\/api\/shows\/([^/]+)\//
const LOCK_CHECK_EXEMPT = /^\/api\/shows\/[^/]+\/(lock|events|history\/[^/]+\/restore)(\/|$)/

const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web-app', 'dist')
const operatorPanelPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'operator-panel.html')
const operatorPanelScriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'operator-panel.js')

function serveOperatorPanel(res) {
  try {
    const html = fs.readFileSync(operatorPanelPath)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
    res.end(html)
  } catch {
    notFound(res)
  }
}

function serveOperatorPanelScript(res) {
  try {
    const js = fs.readFileSync(operatorPanelScriptPath)
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' })
    res.end(js)
  } catch {
    notFound(res)
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
}

const COMPRESSIBLE = new Set(['.js', '.css', '.html', '.json', '.svg', '.xml'])

async function serveStaticFile(res, filePath, cacheControl, acceptEncoding = '', req = null) {
  const stat = await fs.promises.stat(filePath)
  if (stat.isDirectory()) throw new Error('EISDIR')
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME[ext] || 'application/octet-stream'
  const compress = COMPRESSIBLE.has(ext) && stat.size > 1024
  const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`

  if (req && req.headers['if-none-match'] === etag) {
    res.writeHead(304, { 'Cache-Control': cacheControl, 'ETag': etag })
    res.end()
    return
  }

  if (compress && acceptEncoding.includes('br')) {
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl, 'Content-Encoding': 'br', 'Vary': 'Accept-Encoding', 'ETag': etag })
    fs.createReadStream(filePath).pipe(zlib.createBrotliCompress()).pipe(res)
  } else if (compress && acceptEncoding.includes('gzip')) {
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', 'ETag': etag })
    fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res)
  } else {
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.size, 'Cache-Control': cacheControl, 'ETag': etag })
    fs.createReadStream(filePath).pipe(res)
  }
}

async function serveStatic(req, res, pathname) {
  const safePathname = pathname === '/' ? '/index.html' : pathname
  const filePath = path.join(distPath, safePathname.replace(/^\//, ''))

  if (!filePath.startsWith(distPath + path.sep) && filePath !== distPath) return notFound(res)

  const isAsset = safePathname.startsWith('/assets/') || /\.[a-zA-Z0-9]+$/.test(safePathname)
  const cacheControl = safePathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
  const acceptEncoding = req.headers['accept-encoding'] || ''

  try {
    await serveStaticFile(res, filePath, cacheControl, acceptEncoding, req)
    return
  } catch {
    if (isAsset) return notFound(res)
  }

  try {
    await serveStaticFile(res, path.join(distPath, 'index.html'), 'no-cache', acceptEncoding, req)
  } catch {
    return notFound(res)
  }
}

const nil = (r) => r === null

// Apple Universal Links: gilt hostunabhängig (Root- und alle Mandanten-Subdomains),
// damit der App-Login-Deep-Link auf jeder team.luxstage.app funktioniert.
const APPLE_APP_SITE_ASSOCIATION = JSON.stringify({
  applinks: {
    details: [
      {
        appIDs: ['4YH5HQEUK5.de.christopherrohde.LuxStageApp'],
        components: [{ '/': '/reset-password', comment: 'Login nach Passwort-Reset in der App öffnen' }],
      },
    ],
  },
})

export async function router(req, res) {
  let pathname, params
  try {
    ;({ pathname, params } = parseUrl(req.url))
  } catch {
    return notFound(res)
  }

  if (req.method === 'GET' && pathname === '/.well-known/apple-app-site-association') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' })
    return res.end(APPLE_APP_SITE_ASSOCIATION)
  }

  if (pathname.startsWith('/api/')) {
    const start = Date.now()
    res.on('finish', () => {
      console.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - start}ms`)
    })
  }

  try {
    if (pathname.startsWith('/api/')) {
      if (isGloballyRateLimited(req)) return json(res, 429, { error: 'Zu viele Anfragen. Bitte warten.' })

      // SaaS-Routing nur im SaaS-Modus (BASE_DOMAIN gesetzt). Im Self-Hosted-Modus
      // sind die SaaS-Module nicht geladen — dieser Block wird komplett übersprungen.
      if (saasEnabled) {
        const saas = getSaas()

        // Caddy On-Demand-TLS ask-Endpoint: host-unabhängig, ohne DB-Kontext.
        if (pathname === '/api/tls-check') return systemRoutes(req, res, pathname)

        // Betreiber-Panel auf admin.<baseDomain>: eigener Kontext, nur Operator-Routen.
        if (saas.isOperatorHost(req)) {
          if (pathname === '/api/health') return systemRoutes(req, res, pathname)
          if (pathname.startsWith('/api/operator/')) {
            const r = await saas.operatorRoutes(req, res, pathname)
            if (r === null) return notFound(res)
            return
          }
          return notFound(res)
        }

        // Mandant aus dem Host ableiten (team-a.luxstage.app -> "team-a").
        const tenantId = saas.resolveTenantId(req)
        if (tenantId) {
          if (!saas.tenantExists(tenantId)) return json(res, 404, { error: 'Unbekannter Mandant' })
          if (saas.isSuspended(tenantId)) return json(res, 403, { error: 'Dieser Zugang wurde gesperrt' })
          return saas.runWithDb(saas.openTenantDb(tenantId), () => handleApi(req, res, pathname, params), tenantId)
        }
      }

      // Kein Mandant (oder Self-Hosted): öffentlicher/globaler Kontext.
      return handleApi(req, res, pathname, params)
    }

    // Betreiber-Panel: eigenständige HTML-Oberfläche auf admin.<baseDomain>.
    if (saasEnabled && req.method === 'GET' && getSaas().isOperatorHost(req)) {
      if (pathname === '/operator-panel.js') return serveOperatorPanelScript(res)
      return serveOperatorPanel(res)
    }

    // Root-Domain: Caddy reicht dort nur /register* durch (alles andere bleibt
    // bei der Marketing-Website) — zur Verteidigung in der Tiefe hier zusätzlich
    // serverseitig einschränken, falls Caddy je anders konfiguriert wird.
    if (saasEnabled && req.method === 'GET' && getSaas().isRootHost(req)) {
      const isAsset = pathname.startsWith('/assets/') || /\.[a-zA-Z0-9]+$/.test(pathname)
      if (!isAsset && !PUBLIC_SPA_PATHS.has(pathname)) return notFound(res)
      return serveStatic(req, res, pathname)
    }

    if (req.method === 'GET') return serveStatic(req, res, pathname)

    return notFound(res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) json(res, 500, { error: 'Interner Fehler' })
  }
}

// SPA-Routen, die auf der Root-Domain erreichbar bleiben (nur Registrierung).
// Login/Reset laufen ausschließlich pro Mandant auf <team>.<baseDomain>.
const PUBLIC_SPA_PATHS = new Set([
  '/register',
  '/register/confirm',
])

async function handleApi(req, res, pathname, params) {
  if (!PUBLIC_ROUTES.has(`${req.method} ${pathname}`)) {
    const user = authenticate(req)
    if (!user) return json(res, 401, { error: 'Nicht angemeldet' })
    // Token an Subdomain binden: ein für Mandant A ausgestellter Token darf nicht
    // auf der Subdomain von Mandant B gelten.
    const tenantId = getTenantId()
    if (tenantId && user.tenantId !== tenantId) {
      return json(res, 403, { error: 'Token gilt nicht für diesen Mandanten' })
    }
    req.user = user
  }
  return dispatchApi(req, res, pathname, params)
}

async function dispatchApi(req, res, pathname, params) {
  if (saasEnabled && pathname.startsWith('/api/register')) {
    return dispatchRoute(getSaas().registerRoutes, req, res, pathname, params)
  }

  if (WRITE_METHODS.has(req.method) && !LOCK_CHECK_EXEMPT.test(pathname)) {
    const m = SHOW_WRITE_PATH.exec(pathname)
    if (m) {
      const lock = getLock(m[1])
      if (lock && lock.user !== req.user.username) {
        return json(res, 423, { ok: false, lockedBy: lock.user, since: lock.since })
      }
    }
  }

  const directRoute = API_ROUTE_HANDLERS.find(route => route.matches(pathname))
  if (directRoute) return dispatchRoute(directRoute.handler, req, res, pathname, params)

  if (pathname.startsWith('/api/shows/')) {
    const showRoute = SHOW_ROUTE_HANDLERS.find(route => route.matches(pathname))
    if (showRoute) {
      const handled = await showRoute.handler(req, res, pathname, params)
      if (!nil(handled)) return
    }
    return dispatchRoute(showRoutes, req, res, pathname, params)
  }

  if (pathname === '/api/shows' || pathname === '/api/shows/archived') {
    return dispatchRoute(showRoutes, req, res, pathname, params)
  }
  return dispatchRoute(systemRoutes, req, res, pathname, params)
}

async function dispatchRoute(handler, req, res, pathname, params) {
  let result
  try {
    result = await handler(req, res, pathname, params)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) json(res, 500, { error: 'Interner Serverfehler' })
    return
  }
  if (nil(result)) notFound(res)
}

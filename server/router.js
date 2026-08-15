import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { parseUrl, notFound, json } from './helpers.js'
import { authenticate } from './auth.js'
import { getTenantId } from './db-context.js'
import { saasEnabled, getSaas } from './saas.js'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { showRoutes } from './routes/shows.js'
import { channelRoutes } from './routes/channels.js'
import { photoRoutes } from './routes/photos.js'
import { sectionRoutes } from './routes/sections.js'
import { templateRoutes } from './routes/templates.js'
import { floorplanRoutes } from './routes/floorplan.js'
import { historyRoutes } from './routes/history.js'
import { systemRoutes } from './routes/system.js'
import { smtpRoutes } from './routes/smtp.js'
import { displayRoutes } from './routes/display.js'
import { updateRoutes } from './routes/update.js'
import { pdfRoutes } from './routes/pdf.js'
import { towerRoutes } from './routes/towers.js'
import { barRoutes } from './routes/bars.js'

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

export async function router(req, res) {
  let pathname, params
  try {
    ;({ pathname, params } = parseUrl(req.url))
  } catch {
    return notFound(res)
  }

  if (pathname.startsWith('/api/')) {
    const start = Date.now()
    res.on('finish', () => {
      console.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - start}ms`)
    })
  }

  try {
    if (pathname.startsWith('/api/')) {
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

// Öffentliche API-Endpunkte ohne Auth (im jeweiligen DB-Kontext ausgeführt).
// Methode und Pfad gehören zusammen, damit etwa ein POST auf den Health-Pfad
// nicht unabsichtlich dieselbe Ausnahme wie sein öffentlicher GET-Check erhält.
const PUBLIC_ROUTES = new Set([
  'POST /api/auth/login',
  'GET /api/auth/capabilities',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password/confirm',
  'GET /api/health',
  'POST /api/register',
  'GET /api/register/confirm',
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
      // Reihenfolge: spezifische Prefixe zuerst
      if (saasEnabled && pathname.startsWith('/api/register')) { const r = await getSaas().registerRoutes(req, res, pathname); if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/auth/'))         { const r = await authRoutes(req, res, pathname);          if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/me/'))            { const r = await userRoutes(req, res, pathname);          if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/users'))          { const r = await userRoutes(req, res, pathname);          if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/smtp'))           { const r = await smtpRoutes(req, res, pathname);          if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/settings/'))      { const r = await displayRoutes(req, res, pathname);       if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/update'))         { const r = await updateRoutes(req, res, pathname, params); if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/floorplans/'))    { const r = await floorplanRoutes(req, res, pathname);     if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/templates'))      { const r = await templateRoutes(req, res, pathname);      if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/shows/')) {
        // Sub-Ressourcen vor dem Show-Handler (spezifischer zuerst)
        if (/\/channels(\/|$)|\/checks(\/|$)/.test(pathname)) { const r = await channelRoutes(req, res, pathname);   if (!nil(r)) return }
        if (/\/photos(\/|$)|\/photo-/.test(pathname)) { const r = await photoRoutes(req, res, pathname, params);     if (!nil(r)) return }
        if (/\/sections(\/|$)|\/section-defs/.test(pathname)) { const r = await sectionRoutes(req, res, pathname);  if (!nil(r)) return }
        if (/\/floorplan(\/|$)/.test(pathname))       { const r = await floorplanRoutes(req, res, pathname);        if (!nil(r)) return }
        if (/\/towers(\/|$)/.test(pathname))           { const r = await towerRoutes(req, res, pathname);            if (!nil(r)) return }
        if (/\/bars(\/|$)/.test(pathname))             { const r = await barRoutes(req, res, pathname);              if (!nil(r)) return }
        if (/\/history(\/|$)/.test(pathname))         { const r = await historyRoutes(req, res, pathname);          if (!nil(r)) return }
        if (/\/pdf$/.test(pathname))                  { const r = await pdfRoutes(req, res, pathname);              if (nil(r)) notFound(res); return }
        { const r = await showRoutes(req, res, pathname, params); if (nil(r)) notFound(res); return }
      }
      if (pathname === '/api/shows' || pathname === '/api/shows/archived') {
        const r = await showRoutes(req, res, pathname, params); if (nil(r)) notFound(res); return
      }
      { const r = await systemRoutes(req, res, pathname); if (nil(r)) notFound(res); return }
}

import { config } from './config.js'

export function clientIp(req) {
  if (config.trustProxy && req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim()
  }
  return req.socket.remoteAddress || 'unknown'
}

export function readBodyBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0
    req.on('data', c => {
      size += c.length
      if (size > maxBytes) { req.destroy(); return reject(new Error('Body zu groß')) }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function readBody(req, maxBytes = 1_048_576) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0
    req.on('data', c => {
      size += c.length
      if (size > maxBytes) { req.destroy(); return reject(new Error('Body zu groß')) }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export async function readJsonBody(req, res, maxBytes) {
  let raw
  try { raw = await readBody(req, maxBytes) } catch {
    json(res, 413, { error: 'Request zu groß' }); return null
  }
  if (!raw.trim()) return {}
  try { return JSON.parse(raw) } catch {
    json(res, 400, { error: 'Ungültiger JSON-Body' }); return null
  }
}

export function json(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders })
  res.end(JSON.stringify(data))
}

export function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType })
  res.end(body)
}

export function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Nicht gefunden' }))
}

export function parseUrl(url) {
  const u = new URL(url, 'http://localhost')
  return { pathname: u.pathname, search: u.search, params: Object.fromEntries(u.searchParams) }
}

// Multipart-Upload-Fehler (busboy-Limits, s. photos.js parseMultipart) tragen "zu groß"/
// "zu viele" in der Message — alles andere ist ein regulärer Verarbeitungsfehler (400).
export function uploadErrorStatus(message) {
  return /zu groß|zu viele/i.test(message || '') ? 413 : 400
}

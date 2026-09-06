// CORS-Origin-Prüfung und statische Security-Header für den HTTP-Server (index.js).
// Ausgelagert aus dem http.createServer()-Callback, damit die Policy unabhängig
// vom Transport-Bootstrap testbar ist (siehe audits/software-design-analysis-2026-09-05.md, Finding #7.5).

const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean)

/** Setzt CORS-Header und beantwortet Preflight-OPTIONS-Requests direkt.
 *  Liefert true, wenn der Request damit bereits vollständig behandelt ist. */
export function applyCors(req, res, isDev) {
  const origin = req.headers['origin'] || ''
  if (isDev || (corsOrigins.length > 0 && corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true }
  return false
}

export function applySecurityHeaders(res, isDev = false) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
  // Nur außerhalb lokaler Entwicklung: HSTS auf HTTP wäre irreführend (der
  // Header verspricht ein Verhalten, das ohne echtes HTTPS nicht gilt) und
  // würde lokale HTTP-Entwicklung unnötig erschweren. Im dokumentierten
  // Deployment (Caddy davor, automatisches HTTPS) setzt Caddy HSTS meist
  // bereits selbst — dies ist das App-seitige Fallback für andere Reverse-Proxies.
  if (!isDev) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}

// LuxStage/server/tenant-resolve.js
// Leitet den Mandanten aus dem Host-Header ab: team-a.luxstage.app -> "team-a".
//
// Produktion (baseDomain gesetzt): ausschließlich der Host zählt. Reservierte
// Subdomains (www, app, api) sind KEIN Mandant — dort läuft die öffentliche Seite
// inkl. Registrierung.
//
// Lokal: BASE_DOMAIN=localhost, Mandanten unter <team>.localhost.
import { config } from './config.js'
import { isValidTenantId, tenantExists } from './tenants.js'

// Nicht als Mandant registrierbar: generische, bestehende feste Subdomains
// (appreview/docs zeigen bereits woanders hin) und typische Marketing/Mail-Namen.
const RESERVED = new Set([
  // generisch / infrastruktur
  'www', 'app', 'api', 'admin', 'static', 'assets',
  // bestehende feste Subdomains unter luxstage.app
  'appreview', 'docs',
  // marketing / mail (reserviert für spätere Nutzung)
  'mail', 'mx', 'smtp', 'imap', 'pop', 'cdn', 'blog', 'shop',
  'help', 'support', 'status', 'dev', 'staging', 'test',
])

// Host-Header ohne Port. Gibt '' zurück, wenn keiner da ist.
function hostname(req) {
  const raw = (req.headers['host'] || '').toLowerCase()
  return raw.split(':')[0]
}

// Ist dieser Name als Subdomain reserviert (nicht als Mandant registrierbar)?
export function isReservedSubdomain(name) {
  return RESERVED.has(String(name).toLowerCase())
}

// Läuft der Request auf der Betreiber-Subdomain admin.<baseDomain>?
export function isOperatorHost(req) {
  const base = config.baseDomain.toLowerCase()
  return hostname(req) === 'admin.' + base
}

// Läuft der Request auf der Root-Domain (luxstage.app selbst)? Dort läuft nur
// der schmale, öffentliche Registrierungs-Flow (kein Mandant existiert zu
// diesem Zeitpunkt) — kein Login, keine Show-Verwaltung. Caddy reicht dafür nur
// bestimmte Pfade durch (/register, /register/confirm), alles andere bleibt bei
// der Marketing-Website.
export function isRootHost(req) {
  const base = config.baseDomain.toLowerCase()
  return hostname(req) === base
}

// Für Caddy On-Demand-TLS: Darf für diese Domain ein Zertifikat geholt werden?
// Erlaubt: Root-Domain, admin.<base>, und existierende Mandanten-Subdomains.
// Verhindert, dass Fremd-Hostnamen Caddy zu Let's-Encrypt-Anfragen zwingen.
export function isKnownDomain(domain) {
  const base = config.baseDomain.toLowerCase()
  if (!domain) return false
  const host = String(domain).toLowerCase().trim().split(':')[0]
  if (host === base) return true            // Root
  if (host === 'admin.' + base) return true // Betreiber-Panel
  const suffix = '.' + base
  if (!host.endsWith(suffix)) return false
  const sub = host.slice(0, -suffix.length)
  if (!sub || sub.includes('.') || RESERVED.has(sub)) return false
  return isValidTenantId(sub) && tenantExists(sub)
}

// URL der Mandanten-Subdomain, z. B. für Links in E-Mails.
export function tenantBaseUrl(tenantId) {
  if (config.baseDomain === 'localhost') return config.appUrl
  return `https://${tenantId}.${config.baseDomain}`
}

// Ermittelt die tenantId für diesen Request oder null (öffentlicher Kontext).
export function resolveTenantId(req) {
  const base = config.baseDomain.toLowerCase()

  const host = hostname(req)
  // Muss exakt <sub>.<base> sein.
  const suffix = '.' + base
  if (!host.endsWith(suffix)) return null
  const sub = host.slice(0, -suffix.length)
  // Nur eine Ebene (kein team.a.luxstage.app), kein reservierter Name.
  if (!sub || sub.includes('.') || RESERVED.has(sub)) return null
  return isValidTenantId(sub) ? sub : null
}

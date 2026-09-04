import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { showRoutes } from './routes/shows.js'
import { channelRoutes, channelStatsRoutes } from './routes/channels.js'
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
import { networkRoutes } from './routes/network.js'

// Deklarative Route-Tabelle: eine Zeile pro Handler-Gruppe (nicht pro
// Einzelendpoint — die Handler-Dateien parsen Methode/Pfad innerhalb ihrer
// Gruppe weiterhin selbst). Zentralisiert, was vorher als drei getrennte
// Strukturen (PUBLIC_ROUTES / API_ROUTE_HANDLERS / SHOW_ROUTE_HANDLERS) direkt
// in router.js stand, ohne deren Matching-Verhalten zu ändern.
//
// Handler-Vertrag: `null` zurückgeben heißt "nicht zuständig" — der nächste
// Handler bzw. 404 übernimmt. Jede andere Rückgabe (auch `undefined`) heißt
// "zuständig"; dann MUSS die Response geschrieben sein. dispatchRoute() in
// router.js antwortet sonst mit 500 statt den Request hängen zu lassen.
//
// req.user ist in jedem über handleApi() erreichten Handler gefahrlos direkt
// lesbar (Auth lief bereits davor) — requireAuth()-Aufrufe innerhalb einzelner
// Handler sind defensive Verteidigung in der Tiefe, nicht tragend.

// Öffentliche API-Endpunkte ohne Auth (im jeweiligen DB-Kontext ausgeführt).
// Methode und Pfad gehören zusammen, damit etwa ein POST auf den Health-Pfad
// nicht unabsichtlich dieselbe Ausnahme wie sein öffentlicher GET-Check erhält.
export const PUBLIC_ROUTES = new Set([
  'POST /api/auth/login',
  'GET /api/auth/capabilities',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password/confirm',
  'GET /api/health',
  'POST /api/register',
  'GET /api/register/confirm',
  'POST /api/self-register',
])

// Globale API-Gruppen, per Pfad-Präfix oder Prädikat erkannt.
export const API_ROUTE_HANDLERS = [
  { matches: pathname => pathname.startsWith('/api/auth/'), handler: authRoutes },
  { matches: pathname => pathname.startsWith('/api/me/') || pathname.startsWith('/api/users') || pathname === '/api/self-register', handler: userRoutes },
  { matches: pathname => pathname.startsWith('/api/smtp'), handler: smtpRoutes },
  { matches: pathname => pathname.startsWith('/api/settings/'), handler: displayRoutes },
  { matches: pathname => pathname.startsWith('/api/update'), handler: updateRoutes },
  { matches: pathname => pathname.startsWith('/api/floorplans/'), handler: floorplanRoutes },
  { matches: pathname => pathname.startsWith('/api/templates'), handler: templateRoutes },
  { matches: pathname => pathname.startsWith('/api/channels/color-usage'), handler: channelStatsRoutes },
  { matches: pathname => pathname.startsWith('/api/network/'), handler: networkRoutes },
]

// Show-Unterressourcen unter /api/shows/:id/... — erste Übereinstimmung
// gewinnt, Fallback ist showRoutes selbst (Show-CRUD, Meta).
export const SHOW_ROUTE_HANDLERS = [
  { matches: pathname => /\/channels(\/|$)|\/checks(\/|$)|\/circuit-scan$/.test(pathname), handler: channelRoutes },
  { matches: pathname => /\/photos(\/|$)|\/photo-/.test(pathname), handler: photoRoutes },
  { matches: pathname => /\/sections(\/|$)|\/section-defs/.test(pathname), handler: sectionRoutes },
  { matches: pathname => /\/floorplan(\/|$)/.test(pathname), handler: floorplanRoutes },
  { matches: pathname => /\/towers(\/|$)/.test(pathname), handler: towerRoutes },
  { matches: pathname => /\/bars(\/|$)/.test(pathname), handler: barRoutes },
  { matches: pathname => /\/history(\/|$)/.test(pathname), handler: historyRoutes },
  { matches: pathname => /\/pdf$/.test(pathname), handler: pdfRoutes },
]

export { showRoutes, systemRoutes }

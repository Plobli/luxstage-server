import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { router } from './router.js'
import { config } from './config.js'
import { startHistoryJob } from './history.js'
import { saasEnabled } from './saas.js'
import { initDb } from './db-init.js'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)))

// Verhindert, dass versehentlich zwei Server-Prozesse gleichzeitig auf dieselbe
// SQLite-DB schreiben (führte bereits zu "database disk image is malformed").
// Lockfile enthält die PID des laufenden Prozesses; ein zweiter Start prüft,
// ob dieser Prozess noch lebt, und bricht andernfalls klar ab statt den DB-Zugriff
// zu teilen.
const lockPath = path.join(config.dataPath, '.server.lock')
function acquireLock() {
  fs.mkdirSync(config.dataPath, { recursive: true })
  if (fs.existsSync(lockPath)) {
    const existingPid = parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10)
    let stillRunning = false
    // existingPid === process.pid: In Containern ist der Server-Prozess fast immer
    // PID 1 (exec im Entrypoint). Nach einem Neustart hat der neue Prozess dieselbe
    // PID wie der alte im Lockfile — das ist kein zweiter Prozess, sondern der Neustart.
    if (existingPid && existingPid !== process.pid) {
      try { process.kill(existingPid, 0); stillRunning = true } catch { stillRunning = false }
    }
    if (stillRunning) {
      console.error(`\nAbbruch: Es läuft bereits ein Server-Prozess (PID ${existingPid}) auf diesem Datenpfad (${config.dataPath}).`)
      console.error('Zwei gleichzeitige Prozesse können die SQLite-Datenbank beschädigen.')
      console.error(`Falls der Prozess nicht mehr laufen sollte: kill ${existingPid}\n`)
      process.exit(1)
    }
  }
  fs.writeFileSync(lockPath, String(process.pid))
  const releaseLock = () => { try { if (fs.readFileSync(lockPath, 'utf8').trim() === String(process.pid)) fs.unlinkSync(lockPath) } catch {} }
  process.on('exit', releaseLock)
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
}
acquireLock()

// Ohne diese Handler beendet Node den Prozess bei jedem unerwarteten Fehler außerhalb des
// Request/Response-Zyklus (Timer-Callback, verpasste .catch()) — riskant, da der Prozess den
// exklusiven DB-Lock oben hält und ein unsauberer Absturz die SQLite-Datei beschädigen kann
// (siehe Kommentar zu acquireLock). unhandledRejection nur loggen: viele Fire-and-Forget-
// Promises (E-Mail-Versand) sind bewusst so eingesetzt, ein Exit bei jeder verpassten .catch()
// wäre zu aggressiv. uncaughtException loggen und fail-fast beenden, statt in undefiniertem
// Zustand weiterzulaufen.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] Unhandled Rejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught Exception:', err)
  process.exit(1)
})

// Erst nach dem Lock öffnen — zwei Prozesse dürfen die Datei nie gleichzeitig anfassen.
// Im SaaS-Betrieb gibt es keine globale DB (jeder Mandant hat seine eigene, siehe
// tenants.js) — sie hier trotzdem zu öffnen, würde nur eine ungenutzte, aber als
// Fallback erreichbare Datei anlegen (siehe getDb() in db-context.js).
if (!saasEnabled) initDb()

const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean)
const isDev = process.env.NODE_ENV === 'development' && !config.baseDomain

const server = http.createServer((req, res) => {
  const origin = req.headers['origin'] || ''
  if (isDev || (corsOrigins.length > 0 && corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline'")

  router(req, res)
})

// Explizite Obergrenzen statt der impliziten Node-Defaults: ein langsam
// sendender Client (z.B. schlechte Mobilfunkverbindung auf der Bühne) soll
// einen Worker-Slot nicht unbegrenzt blockieren können. requestTimeout
// bewusst großzügig gewählt (nicht die reguläre 60s der JSON-Endpunkte),
// da derselbe Server auch Foto-/Backup-Uploads über langsame Verbindungen
// bedient — ein knapperer Wert würde die künstlich abbrechen.
server.headersTimeout = 30_000
server.requestTimeout = 120_000

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nAbbruch: Port ${config.port} ist bereits belegt — läuft der Server schon?\n`)
    process.exit(1)
  }
  throw err
})

server.listen(config.port, '0.0.0.0', () => {
  console.log(`LuxStage Server v${pkg.version} läuft auf Port ${config.port}`)
  console.log(`Datenpfad: ${config.dataPath}`)
  startHistoryJob()
  // Mandanten-Backup-Job nur im SaaS-Modus (Modul dynamisch geladen).
  if (saasEnabled) {
    import('./tenant-backup.js').then(m => m.startBackupJob())
  }
})

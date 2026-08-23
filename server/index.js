import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { router } from './router.js'
import { config } from './config.js'
import { startHistoryJob } from './history.js'
import { saasEnabled } from './saas.js'

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
    if (existingPid) {
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

const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean)
const isDev = process.env.NODE_ENV === 'development'

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

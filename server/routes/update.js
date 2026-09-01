import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { config } from '../config.js'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import unzipper from 'unzipper'
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const GITHUB_REPO = 'Plobli/LuxStage'

function run(cmd, env = {}, maxBuffer = 1024 * 1024) {
  // /bin/sh statt /bin/bash: das node:22-alpine-Laufzeitimage hat kein bash
  // installiert (nur ash über busybox). Ein fest verdrahtetes /bin/bash führte
  // zu 'spawn /bin/bash ENOENT' — der Fehler landete im catch-Zweig, bevor
  // process.exit() je erreicht wurde, sodass der alte Prozess mit bereits
  // ausgetauschten Dateien weiterlief (Server- und App-Version liefen auseinander).
  return new Promise((resolve, reject) =>
    execFile('/bin/sh', ['-c', cmd],
      { maxBuffer, env: { ...process.env, ...env } },
      (err, stdout, stderr) => {
        if (err) { err.stderr = stderr; reject(err) } else { resolve(stdout.trim()) }
      }
    )
  )
}

// Räumt Backup-Verzeichnisse aus fehlgeschlagenen/erfolgreichen Läufen auf.
async function removeIfExists(p) {
  await fsp.rm(p, { recursive: true, force: true }).catch(() => {})
}

export async function updateRoutes(req, res, pathname, params) {
  const { method } = req

  // Im SaaS-Modus verwaltet der Betreiber Updates zentral über den Docker-Image-
  // Rollout — ein Mandant darf den geteilten Server nicht neu starten/ersetzen.
  if (config.baseDomain) {
    const admin = requireAuth(req, res); if (!admin) return
    return json(res, 403, { error: 'Updates werden zentral verwaltet' })
  }

  if (method === 'GET' && pathname === '/api/update/branches') {
    const user = requireAuth(req, res); if (!user) return
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, {
        headers: { 'User-Agent': 'LuxStage-Updater' }
      })
      if (!response.ok) throw new Error('GitHub API Error')
      const releases = await response.json()
      const branches = releases.map(r => r.tag_name)
      return json(res, 200, { branches: branches.length ? branches : ['main'] })
    } catch (err) {
      return json(res, 200, { branches: ['main'], error: err.message })
    }
  }

  if (method === 'GET' && pathname === '/api/update/check') {
    const user = requireAuth(req, res); if (!user) return
    const tag = params.branch || 'main'
    try {
      const pkg = JSON.parse(await fsp.readFile(path.join(repoDir, 'package.json'), 'utf8'))
      const currentVer = pkg.version

      if (tag === 'main') {
         return json(res, 200, { available: false, branch: tag, error: "Wähle ein Release (z.B. v1.21.0) für das Update aus." })
      }
      
      const cleanTag = tag.replace(/^v/, '')
      const isNewer = cleanTag !== currentVer
      
      if (!isNewer) return json(res, 200, { available: false, branch: tag })
      
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tag}`, {
        headers: { 'User-Agent': 'LuxStage-Updater' }
      })
      if (!response.ok) throw new Error('Release nicht gefunden')
      const release = await response.json()
      
      return json(res, 200, { available: true, commits: 1, log: release.name + '\n' + (release.body || ''), branch: tag })
    } catch (err) {
      return json(res, 200, { available: false, branch: tag, error: err.message })
    }
  }

  if (method === 'POST' && pathname === '/api/update') {
    const user = requireAuth(req, res); if (!user) return
    const dbPath     = path.join(config.dataPath, 'luxstage.db')
    const dbSnap     = path.join(config.dataPath, 'luxstage-preupdate.db')
    const tmpZip     = path.join(repoDir, 'tmp-release.zip')
    // Backup der Verzeichnisse, die entpackt werden — nicht nur der DB. Ohne das
    // bleibt bei jedem Fehler NACH dem Entpacken (z.B. npm install schlägt fehl)
    // ein Mischzustand aus neuem und altem Code liegen, während der alte
    // Node-Prozess weiterläuft: Dateisystem und laufender Prozess laufen
    // auseinander, sichtbar z.B. an unterschiedlichen Web-/Server-Versionen.
    const backupDir  = path.join(repoDir, '.update-backup')

    const bodyJson = await readJsonBody(req, res); if (bodyJson === null) return
    const tag = bodyJson.branch || 'main'
    if (!/^[a-zA-Z0-9_.-]+$/.test(tag)) return json(res, 400, { error: 'Ungültiger Tag-Name' })

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    const sendEvent = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const log = []
    const step = (msg) => { log.push(msg); console.log('[update]', msg); sendEvent('log', { msg }) }

    // Welche Top-Level-Einträge das Release-Zip mitbringt (siehe release.yml) —
    // nur diese werden gesichert und im Fehlerfall zurückgespielt.
    const UPDATABLE_ENTRIES = ['server', 'web-app', 'shared', 'package.json', 'package-lock.json']

    async function backupCurrentState() {
      await removeIfExists(backupDir)
      await fsp.mkdir(backupDir, { recursive: true })
      for (const entry of UPDATABLE_ENTRIES) {
        const src = path.join(repoDir, entry)
        if (await fsp.access(src).then(() => true, () => false)) {
          await fsp.cp(src, path.join(backupDir, entry), { recursive: true })
        }
      }
    }

    async function rollback() {
      step('Stelle vorherigen Stand wieder her...')
      for (const entry of UPDATABLE_ENTRIES) {
        const backupSrc = path.join(backupDir, entry)
        if (await fsp.access(backupSrc).then(() => true, () => false)) {
          await removeIfExists(path.join(repoDir, entry))
          await fsp.cp(backupSrc, path.join(repoDir, entry), { recursive: true })
        }
      }
      step('Vorheriger Stand wiederhergestellt.')
    }

    try {
      if (tag === 'main') throw new Error('Release-basiertes Update erfordert einen GitHub Tag (z.B. v1.0.0).')

      step(`Starte Update auf Version ${tag}...`)
      await fsp.copyFile(dbPath, dbSnap).catch(() => {})
      step('DB-Snapshot erstellt')

      const zipUrl = `https://github.com/${GITHUB_REPO}/releases/download/${tag}/luxstage-release.zip`
      step(`Lade Release herunter...`)

      const response = await fetch(zipUrl)
      if (!response.ok) throw new Error(`Download fehlgeschlagen: HTTP ${response.status}`)

      const buffer = await response.arrayBuffer()
      await fsp.writeFile(tmpZip, Buffer.from(buffer))

      step('Sichere aktuellen Stand...')
      await backupCurrentState()

      try {
        step('Entpacke Dateien über das aktuelle Verzeichnis...')
        // Kein unzipper.Extract: das würde blind alles überschreiben, inklusive
        // umgebungsspezifischer Infrastruktur-Dateien wie docker-compose.yml oder
        // Dockerfile — lokale Anpassungen (z.B. Netzwerke, Ports) wären nach jedem
        // Update weg. Diese Dateien werden hier bewusst übersprungen, das Release-Zip
        // enthält ohnehin nur Anwendungscode (siehe .github/workflows/release.yml).
        const PROTECTED_FILES = new Set([
          'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
          '.env', '.env.example', 'entrypoint.sh',
        ])
        const zip = fs.createReadStream(tmpZip).pipe(unzipper.Parse({ forceStream: true }))
        for await (const entry of zip) {
          const relPath = entry.path.replace(/\\/g, '/')
          if (!relPath || relPath.endsWith('/') || entry.type === 'Directory') { entry.autodrain(); continue }
          if (relPath.includes('..') || path.isAbsolute(relPath)) { entry.autodrain(); continue }
          if (PROTECTED_FILES.has(relPath)) { entry.autodrain(); continue }
          const destPath = path.resolve(repoDir, relPath)
          if (!destPath.startsWith(repoDir + path.sep)) { entry.autodrain(); continue }
          await fsp.mkdir(path.dirname(destPath), { recursive: true })
          await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(destPath)
            entry.pipe(out)
            out.on('finish', resolve)
            out.on('error', (err) => { out.destroy(); reject(err) })
            entry.on('error', (err) => { out.destroy(); reject(err) })
          })
        }
        step('Dateien erfolgreich entpackt.')

        step('Installiere Server-Abhängigkeiten...')
        await run(`cd "${path.join(repoDir, 'server')}" && npm install --omit=dev`)

        step('Prüfe, ob der neue Code lädt...')
        // Echter Modul-Import in einem separaten Prozess, nicht nur `node --check`:
        // --check prüft ausschließlich Syntax, keine Imports — genau das ließ den
        // fehlenden shared/-Ordner (ERR_MODULE_NOT_FOUND) früher unbemerkt durch.
        // Läuft bewusst in einem separaten Prozess mit eigenem, temporärem
        // DATA_PATH: der neue Code könnte beim Laden Konfiguration erwarten
        // oder (bei älteren Ständen) noch beim Import eine DB öffnen.
        const smokeTestDataDir = path.join(repoDir, '.update-smoketest-data')
        const routerUrl = pathToFileURL(path.join(repoDir, 'server', 'router.js')).href
        await removeIfExists(smokeTestDataDir)
        try {
          // pathToFileURL statt rohem Pfad-String: repoDir könnte Leer- oder
          // Sonderzeichen enthalten, die die -e-Inline-Auswertung sonst zerlegen.
          await run(
            `node --input-type=module -e "import('${routerUrl}').then(() => process.exit(0))"`,
            { DATA_PATH: smokeTestDataDir, JWT_SECRET: randomBytes(24).toString('hex') }
          )
        } finally {
          await removeIfExists(smokeTestDataDir)
        }
      } catch (err) {
        await rollback()
        throw err
      }

      step('Aufräumen...')
      await fsp.unlink(tmpZip).catch(()=>{})
      await fsp.unlink(dbSnap).catch(()=>{})
      await removeIfExists(backupDir)

      step('Neustart...')
      sendEvent('done', { log })
      res.end()
      setTimeout(() => process.exit(0), 500)
    } catch (err) {
      step(`Fehler: ${err.message}`)
      await fsp.unlink(tmpZip).catch(()=>{})
      sendEvent('done', { error: err.message, log })
      res.end()
    }
    return
  }

  return null
}

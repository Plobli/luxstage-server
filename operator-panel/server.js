// LuxStage Betreiber-Panel — eigenständiger, zustandsloser Static-Server.
// Liefert nur HTML/JS aus; die eigentliche Operator-API (/api/operator/*)
// bleibt im Hauptserver (luxstage-saas), einzigem SQLite-Writer.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const indexPath = path.join(dir, 'index.html')
const scriptPath = path.join(dir, 'operator-panel.js')
const port = process.env.PORT || 3001

function serveFile(res, filePath, contentType) {
  try {
    const body = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0]
  if (req.method !== 'GET') {
    res.writeHead(405)
    return res.end('Method not allowed')
  }
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end('ok')
  }
  if (pathname === '/operator-panel.js') return serveFile(res, scriptPath, 'application/javascript; charset=utf-8')
  return serveFile(res, indexPath, 'text/html; charset=utf-8')
})

server.listen(port, () => {
  console.log(`LuxStage Betreiber-Panel läuft auf Port ${port}`)
})

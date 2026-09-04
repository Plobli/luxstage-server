// server/version.js
// App-Version aus package.json, ergänzt um die Git-Commit-Anzahl als Build-Nummer.
// Eigenes Modul statt Teil von routes/system.js — routes/operator.js braucht
// den Wert ebenfalls und sollte dafür keine andere Route-Datei importieren.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

let version
;({ version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))))
try {
  const buildNum = execSync('git rev-list --count HEAD', { stdio: 'pipe' }).toString().trim()
  version = `${version} Build ${buildNum}`
} catch {
  // Bei einem Prod-Release fehlt der .git Ordner im ZIP, daher wird der Catch-Block erreicht
  // und die Version bleibt wie in der package.json definiert (z.B. "2026.4.1").
}

export { version }

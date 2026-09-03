import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PassThrough, Readable } from 'node:stream'
import { after, test } from 'node:test'
import unzipper from 'unzipper'
import Database from 'better-sqlite3'
import { cleanupDataPath, dataPath } from './helpers/test-env.js'

const { setSecretSetting, setSetting } = await import('../db/settings.js')
const { createResetToken } = await import('../db/users.js')
const { streamBackup, restoreBackup } = await import('../backup.js')

// streamBackup schreibt via archive.pipe(res) — res muss ein echter Writable-Stream sein,
// kein reines writeHead/end-Mock wie createResponse() in test-env.js.
function collectingResponse() {
  const sink = new PassThrough()
  const chunks = []
  sink.on('data', c => chunks.push(c))
  sink.writeHead = function (code, h) { this.statusCode = code; if (h) this.headers = h; this.headersSent = true }
  sink.statusCode = null
  sink.headers = {}
  sink.headersSent = false
  sink.buffer = () => Buffer.concat(chunks)
  return sink
}

async function readZipEntry(buffer, entryName) {
  const directory = await unzipper.Open.buffer(buffer)
  const file = directory.files.find(f => f.path === entryName)
  if (!file) return null
  return file.buffer()
}

test('streamBackup entfernt das SMTP-Passwort aus der exportierten DB', async () => {
  setSecretSetting('smtp.pass', 'geheimes-passwort-123')
  setSetting('smtp.host', 'smtp.example.com')

  const res = collectingResponse()
  await new Promise((resolve, reject) => {
    res.on('finish', resolve)
    res.on('error', reject)
    streamBackup(res).catch(reject)
  })

  assert.equal(res.statusCode, 200)
  const dbBuffer = await readZipEntry(res.buffer(), 'luxstage.db')
  assert.ok(dbBuffer, 'luxstage.db muss im Backup-ZIP enthalten sein')

  const tmpDbPath = path.join(dataPath, 'scrub-check.db')
  fs.writeFileSync(tmpDbPath, dbBuffer)
  const db = new Database(tmpDbPath, { readonly: true })
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'smtp.pass'").get()
    assert.equal(row, undefined, 'smtp.pass darf nach dem Export nicht mehr in der settings-Tabelle stehen')
    const rawContent = fs.readFileSync(tmpDbPath, 'latin1')
    assert.ok(!rawContent.includes('geheimes-passwort-123'), 'Klartext-Passwort darf nirgends in der exportierten DB-Datei stehen')
  } finally {
    db.close()
    fs.rmSync(tmpDbPath, { force: true })
  }
})

test('streamBackup entfernt offene Passwort-Reset-Token aus der exportierten DB', async () => {
  createResetToken('a'.repeat(64), 'anna', 60 * 60 * 1000)

  const res = collectingResponse()
  await new Promise((resolve, reject) => {
    res.on('finish', resolve)
    res.on('error', reject)
    streamBackup(res).catch(reject)
  })

  const dbBuffer = await readZipEntry(res.buffer(), 'luxstage.db')
  const tmpDbPath = path.join(dataPath, 'scrub-check-2.db')
  fs.writeFileSync(tmpDbPath, dbBuffer)
  const db = new Database(tmpDbPath, { readonly: true })
  try {
    const count = db.prepare('SELECT COUNT(*) AS n FROM password_resets').get().n
    assert.equal(count, 0)
  } finally {
    db.close()
    fs.rmSync(tmpDbPath, { force: true })
  }
})

test('restoreBackup lehnt einen zweiten gleichzeitigen Restore mit 409 ab', async () => {
  // Ein Request, dessen Body-Stream bewusst nie endet — hält restoreInProgress
  // aktiv, während der zweite Aufruf gestartet wird. restoreInProgress wird
  // synchron beim Funktionseintritt gesetzt (vor jedem await in restoreBackup),
  // daher setzt bereits der synchrone Aufruf beider Promises in derselben
  // Task ohne Zwischen-await den Guard rechtzeitig. Der erste Aufruf wird
  // bewusst nicht abgewartet/beendet — er ist für diesen Test nur das
  // "hängende" Vehikel, das restoreInProgress aktiv hält; sein eigener
  // Fehlerpfad ist nicht Gegenstand dieses Tests.
  const hangingReq = new PassThrough()
  hangingReq.on('error', () => {})
  const firstRes = collectingResponse()
  restoreBackup(hangingReq, firstRes).catch(() => {})

  const secondReq = Readable.from([Buffer.from('irrelevant')])
  const secondRes = collectingResponse()
  await restoreBackup(secondReq, secondRes)

  assert.equal(secondRes.statusCode, 409)
})

after(cleanupDataPath)

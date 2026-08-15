// LuxStage/server/backup.js
import fs from 'node:fs/promises'
import { createWriteStream, createReadStream } from 'node:fs'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import archiver from 'archiver'
import unzipper from 'unzipper'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from './config.js'
import { dbContainer } from './db-init.js'

let restoreInProgress = false
const MAX_BACKUP_BYTES = 500 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 10_000
const MAX_EXTRACTED_BYTES = 2 * 1024 * 1024 * 1024
const MAX_DATABASE_BYTES = 500 * 1024 * 1024
const MAX_PHOTO_BYTES = 50 * 1024 * 1024

export async function streamBackup(res) {
  const backupPath = path.join(config.dataPath, 'luxstage-backup.db')

  try {
    await dbContainer.db.backup(backupPath)
  } catch (err) {
    console.error('Backup fehlgeschlagen:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Backup fehlgeschlagen' }))
    return
  }

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="luxstage-backup-${timestamp()}.zip"`,
    'Referrer-Policy': 'no-referrer',
  })

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.on('error', err => {
    console.error('Archive error:', err)
    res.destroy(err)
  })
  archive.pipe(res)
  archive.file(backupPath, { name: 'luxstage.db' })
  archive.directory(path.join(config.dataPath, 'photos'), 'photos')
  await archive.finalize()
  fs.unlink(backupPath).catch(() => {})
}

export async function restoreBackup(req, res) {
  const dbPath = path.join(config.dataPath, 'luxstage.db')
  const photosPath = path.join(config.dataPath, 'photos')

  if (restoreInProgress) {
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Eine Wiederherstellung läuft bereits' }))
    return
  }
  restoreInProgress = true

  let workDir
  try {
    workDir = await fs.mkdtemp(path.join(config.dataPath, '.restore-'))
    const restorePath = path.join(workDir, 'backup.zip')
    const dbRestorePath = path.join(workDir, 'luxstage.db')
    const stagedPhotosPath = path.join(workDir, 'photos')

    // Step 1: Upload in ein request-eigenes Arbeitsverzeichnis schreiben.
    await writeRequestToFile(req, restorePath, MAX_BACKUP_BYTES)

    // Step 2: DB isoliert extrahieren und prüfen.
    const limits = { entries: 0, extractedBytes: 0 }
    const hasDb = await extractDatabase(restorePath, dbRestorePath, limits)
    if (!hasDb) throw new RestoreError(400, 'ZIP enthält keine luxstage.db')
    await verifyDatabase(dbRestorePath)

    // Step 3: Fotos ebenfalls isoliert extrahieren. Live-Daten bleiben unberührt.
    await extractPhotos(restorePath, stagedPhotosPath, limits)

    // Step 4: Alte Daten sichern, dann DB und Fotos als Paar aktivieren.
    await activateRestore({ workDir, dbRestorePath, stagedPhotosPath, dbPath, photosPath })

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, restart: true }))
    setTimeout(() => process.exit(0), 500)
  } catch (err) {
    console.error('Restore: DB-Austausch fehlgeschlagen:', err)
    const status = err instanceof RestoreError ? err.status : 500
    const error = err instanceof RestoreError ? err.message : 'Wiederherstellung fehlgeschlagen'
    if (!res.headersSent) {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error }))
    }
  } finally {
    restoreInProgress = false
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

class RestoreError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function writeRequestToFile(req, target, maxBytes) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(target)
    let received = 0
    req.on('data', chunk => {
      received += chunk.length
      if (received > maxBytes) {
        req.destroy()
        output.destroy()
        reject(new RestoreError(413, 'Upload zu groß'))
      }
    })
    req.pipe(output)
    output.on('finish', resolve)
    output.on('error', reject)
    req.on('error', reject)
  })
}

async function extractDatabase(archivePath, targetPath, limits) {
  let hasDb = false
  try {
    const zip = createReadStream(archivePath).pipe(unzipper.Parse({ forceStream: true }))
    for await (const entry of zip) {
      countArchiveEntry(limits)
      if (entry.path === 'luxstage.db' && !hasDb) {
        hasDb = true
        await pipeEntry(entry, targetPath, limits, MAX_DATABASE_BYTES)
      } else {
        entry.autodrain()
      }
    }
    return hasDb
  } catch {
    throw new RestoreError(400, 'Ungültiges ZIP-Archiv')
  }
}

async function verifyDatabase(dbPath) {
  let database
  try {
    database = new Database(dbPath, { readonly: true })
    const result = database.prepare('PRAGMA integrity_check').all()
    if (result.length !== 1 || result[0].integrity_check !== 'ok') {
      throw new Error('integrity_check failed')
    }
  } catch {
    throw new RestoreError(400, 'Datenbank-Integritätsprüfung fehlgeschlagen')
  } finally {
    database?.close()
  }
}

async function extractPhotos(archivePath, photosPath, limits) {
  await fs.mkdir(photosPath, { recursive: true })
  try {
    const zip = createReadStream(archivePath).pipe(unzipper.Parse({ forceStream: true }))
    for await (const entry of zip) {
      countArchiveEntry(limits)
      const relativePath = entry.path.startsWith('photos/')
        ? entry.path.slice('photos/'.length).replace(/\\/g, '/')
        : null
      if (!isSafePhotoPath(relativePath, entry.type)) {
        entry.autodrain()
        continue
      }
      const targetPath = path.resolve(photosPath, relativePath)
      if (!targetPath.startsWith(photosPath + path.sep)) {
        entry.autodrain()
        continue
      }
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await pipeEntry(entry, targetPath, limits, MAX_PHOTO_BYTES)
    }
  } catch (err) {
    if (err instanceof RestoreError) throw err
    throw new RestoreError(400, 'Foto-Extraktion fehlgeschlagen')
  }
}

function isSafePhotoPath(relativePath, entryType) {
  return Boolean(
    relativePath &&
    !relativePath.endsWith('/') &&
    entryType !== 'Directory' &&
    !relativePath.includes('..') &&
    !path.isAbsolute(relativePath) &&
    relativePath.length <= 255 &&
    /\.(jpg|jpeg|png|gif|webp)$/i.test(relativePath)
  )
}

function countArchiveEntry(limits) {
  limits.entries += 1
  if (limits.entries > MAX_ARCHIVE_ENTRIES) {
    throw new RestoreError(400, 'ZIP enthält zu viele Dateien')
  }
}

async function pipeEntry(entry, targetPath, limits, maxEntryBytes) {
  let entryBytes = 0
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      entryBytes += chunk.length
      limits.extractedBytes += chunk.length
      if (entryBytes > maxEntryBytes) {
        callback(new RestoreError(400, 'ZIP enthält eine zu große Datei'))
      } else if (limits.extractedBytes > MAX_EXTRACTED_BYTES) {
        callback(new RestoreError(400, 'ZIP enthält zu viele entpackte Daten'))
      } else {
        callback(null, chunk)
      }
    },
  })
  await pipeline(entry, limiter, createWriteStream(targetPath))
}

async function activateRestore({ workDir, dbRestorePath, stagedPhotosPath, dbPath, photosPath }) {
  const previousDbPath = path.join(workDir, 'previous-luxstage.db')
  const previousPhotosPath = path.join(workDir, 'previous-photos')
  let dbMoved = false
  let photosMoved = false

  try {
    dbContainer.db.close()
    await fs.rename(dbPath, previousDbPath)
    dbMoved = true
    await fs.rename(dbRestorePath, dbPath)
    await fs.rename(photosPath, previousPhotosPath).catch(err => {
      if (err.code !== 'ENOENT') throw err
    })
    photosMoved = true
    await fs.rename(stagedPhotosPath, photosPath)
  } catch (err) {
    await fs.rm(dbPath, { force: true }).catch(() => {})
    if (dbMoved) await fs.rename(previousDbPath, dbPath).catch(() => {})
    if (photosMoved) {
      await fs.rm(photosPath, { recursive: true, force: true }).catch(() => {})
      await fs.rename(previousPhotosPath, photosPath).catch(() => {})
    }
    throw err
  }
}

function timestamp() {
  return new Date().toISOString().slice(0, 10)
}

// LuxStage/server/photos.js
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Busboy from 'busboy'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import sharp from 'sharp'
import { config } from './config.js'
import * as db from './db.js'

function photosDir(slug) {
  const base = path.join(config.dataPath, 'photos')
  const resolved = path.resolve(base, slug)
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Invalid slug')
  }
  return resolved
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

export async function savePhoto(slug, filename, source) {
  const dir = photosDir(slug)
  await ensureDir(dir)

  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
  const outName = await uniqueName(dir, safeName.replace(/\.[^.]+$/, '.jpg'))
  const outPath = path.join(dir, outName)
  const tmpPath = `${outPath}.tmp`

  const sharpInstance = sharp(source).rotate()

  await sharpInstance
    .clone()
    .resize({ width: config.photoMaxWidth, withoutEnlargement: true })
    .jpeg({ quality: config.photoQuality })
    .toFile(tmpPath)
  await fs.rename(tmpPath, outPath)

  // Thumbnail generieren
  const thumbPath = path.join(dir, thumbName(outName))
  const tmpThumb = `${thumbPath}.tmp`
  await sharpInstance
    .clone()
    .resize({ width: config.photoThumbWidth, withoutEnlargement: true })
    .jpeg({ quality: config.photoThumbQuality })
    .toFile(tmpThumb)
  await fs.rename(tmpThumb, thumbPath)

  return outName
}

// Kollisionen vermeiden: IMG_0001.jpg → IMG_0001_2.jpg → IMG_0001_3.jpg.
// Auch der Thumbnail-Name muss frei sein, sonst überschreibt sich das Vorschaubild.
async function uniqueName(dir, name) {
  const stem = name.replace(/\.jpg$/i, '')
  let candidate = name
  for (let n = 2; ; n++) {
    const taken = await Promise.all([
      exists(path.join(dir, candidate)),
      exists(path.join(dir, thumbName(candidate))),
    ])
    if (!taken.includes(true)) return candidate
    candidate = `${stem}_${n}.jpg`
  }
}

async function exists(p) {
  try { await fs.access(p); return true } catch { return false }
}

function thumbName(filename) {
  return filename.replace(/\.jpg$/i, '_thumb.jpg')
}

export function getPhotoThumbPath(slug, filename) {
  const dir = photosDir(slug)
  return path.join(dir, thumbName(path.basename(filename)))
}

/** Thumbnails für alle vorhandenen Fotos einer Show nachgenerieren (Migration) */
export async function ensureThumbs(slug) {
  const dir = photosDir(slug)
  let files
  try {
    files = (await fs.readdir(dir)).filter(f => /\.jpg$/i.test(f) && !f.endsWith('_thumb.jpg'))
  } catch { return }
  for (const file of files) {
    const thumbPath = path.join(dir, thumbName(file))
    try { await fs.access(thumbPath); continue } catch { /* fehlt, generieren */ }
    try {
      const buf = await fs.readFile(path.join(dir, file))
      const tmp = `${thumbPath}.tmp`
      await sharp(buf)
        .resize({ width: config.photoThumbWidth, withoutEnlargement: true })
        .jpeg({ quality: config.photoThumbQuality })
        .toFile(tmp)
      await fs.rename(tmp, thumbPath)
    } catch { /* einzelne Fehler ignorieren */ }
  }
}

export async function listPhotos(slug) {
  const dir = photosDir(slug)

  // Migration: vorhandene photo-order.json einmalig in DB übertragen
  const jsonPath = path.join(dir, 'photo-order.json')
  try {
    const raw = await fs.readFile(jsonPath, 'utf8')
    const jsonOrder = JSON.parse(raw)
    if (Array.isArray(jsonOrder) && jsonOrder.length > 0) {
      db.writePhotoOrder(slug, jsonOrder)
    }
    await fs.unlink(jsonPath).catch(() => {})
  } catch { /* Datei existiert nicht oder ungültig — ignorieren */ }

  // Alle vorhandenen Dateien im Verzeichnis
  let files
  try {
    files = (await fs.readdir(dir)).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f) && !f.endsWith('_thumb.jpg'))
  } catch { return [] }

  // Reihenfolge aus DB
  const ordered = db.readPhotoOrder(slug).filter(f => files.includes(f))
  const rest = files.filter(f => !ordered.includes(f)).sort()
  return [...ordered, ...rest]
}

export async function savePhotoOrder(slug, order) {
  const safenames = order.map(f => path.basename(f).replace(/[^a-zA-Z0-9._-]/g, '_'))
  db.writePhotoOrder(slug, safenames)
}

export async function deletePhoto(slug, filename) {
  const dir = photosDir(slug)
  const safeName = path.basename(filename)
  await fs.unlink(path.join(dir, safeName))
  db.deletePhotoOrderEntry(slug, safeName)
}

export function getPhotoPath(slug, filename) {
  return path.join(photosDir(slug), path.basename(filename))
}

const MAX_PHOTO_UPLOAD_BYTES = 50 * 1024 * 1024
const MAX_PHOTO_UPLOAD_FILES = 20

export async function parseMultipart(req) {
  const uploadDir = await fs.mkdtemp(path.join(config.dataPath, '.upload-'))
  const files = []
  let totalBytes = 0
  try {
    await new Promise((resolve, reject) => {
      let rejected = false
      const fail = (error) => {
        if (rejected) return
        rejected = true
        reject(error)
      }
      const parser = Busboy({
        headers: req.headers,
        limits: { fileSize: MAX_PHOTO_UPLOAD_BYTES, files: MAX_PHOTO_UPLOAD_FILES },
      })
      const writes = []

      parser.on('file', (fieldname, stream, info) => {
        const tempPath = path.join(uploadDir, randomUUID())
        const totalLimit = new Transform({
          transform(chunk, encoding, callback) {
            totalBytes += chunk.length
            if (totalBytes > MAX_PHOTO_UPLOAD_BYTES) callback(new Error('Upload zu groß'))
            else callback(null, chunk)
          },
        })
        writes.push(pipeline(stream, totalLimit, createWriteStream(tempPath)).then(() => {
          if (stream.truncated) throw new Error('Upload zu groß')
          files.push({ fieldname, filename: info.filename, path: tempPath })
        }))
      })
      parser.on('filesLimit', () => fail(new Error('Zu viele Dateien')))
      parser.on('error', fail)
      parser.on('finish', async () => {
        try {
          await Promise.all(writes)
          if (!rejected) resolve()
        } catch (error) {
          fail(error)
        }
      })
      req.on('error', fail)
      req.pipe(parser)
    })
    return { files, cleanup: () => fs.rm(uploadDir, { recursive: true, force: true }) }
  } catch (error) {
    await fs.rm(uploadDir, { recursive: true, force: true })
    throw error
  }
}

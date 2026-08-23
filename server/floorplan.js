// LuxStage/server/floorplan.js
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { getTenantId } from './db-context.js'

const ALLOWED_TYPES = ['image/png', 'image/jpeg']

// tenantId ist zu diesem Zeitpunkt bereits über resolveTenantId()/isValidTenantId()
// geprüft (siehe tenant-resolve.js) — hier nur zur Verteidigung in der Tiefe erneut
// validiert, ohne das SaaS-only-Modul tenants.js zu importieren (das Self-Hosted-
// Image enthält diese Datei nicht, siehe Dockerfile).
const VALID_TENANT_ID = /^[a-z0-9][a-z0-9-]{1,62}$/

// Mandant: eigener floorplans-Ordner in seinem Mandantenverzeichnis. Self-Hosted/
// Single-Tenant (kein Mandantenkontext): unverändert flach unter data/floorplans.
function floorplansDir() {
  const tenantId = getTenantId()
  if (!tenantId) return path.join(config.dataPath, 'floorplans')
  if (!VALID_TENANT_ID.test(tenantId)) throw new Error('Ungültige tenantId')
  return path.join(config.dataPath, 'tenants', tenantId, 'floorplans')
}

export async function saveFloorplanImage(templateId, filename, buffer, mimeType) {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error('Ungültiger Dateityp. Erlaubt: PNG, JPG')
  }
  const dir = path.join(floorplansDir(), templateId)
  await fs.mkdir(dir, { recursive: true })

  // Alte Bilder löschen (nur ein Bild pro Template)
  try {
    const existing = await fs.readdir(dir)
    for (const f of existing) await fs.unlink(path.join(dir, f)).catch(() => {})
  } catch {}

  const ext = filename.split('.').pop().toLowerCase().replace('jpeg', 'jpg')
  const safeName = `floorplan.${ext}`
  const finalPath = path.join(dir, safeName)
  const tmpPath = `${finalPath}.tmp`
  await fs.writeFile(tmpPath, buffer)
  await fs.rename(tmpPath, finalPath)
  return path.join(templateId, safeName)
}

export async function deleteFloorplanImage(imagePath) {
  if (!imagePath) return
  const full = path.join(floorplansDir(), imagePath)
  await fs.unlink(full).catch(() => {})
  // Verzeichnis aufräumen falls leer
  await fs.rmdir(path.dirname(full)).catch(() => {})
}

export function floorplanUrl(imagePath) {
  if (!imagePath) return null
  return `/api/floorplans/images/${imagePath}`
}

export async function saveFloorplanSnapshot(showId, buffer, overflow = 0) {
  const dir = path.join(floorplansDir(), showId)
  await fs.mkdir(dir, { recursive: true })
  const finalPath = path.join(dir, 'snapshot.png')
  const tmpPath = `${finalPath}.tmp`
  await fs.writeFile(tmpPath, buffer)
  await fs.rename(tmpPath, finalPath)
  await fs.writeFile(path.join(dir, 'snapshot-meta.json'), JSON.stringify({ overflow }))
}

export function getFloorplanSnapshotPath(showId) {
  return path.join(floorplansDir(), showId, 'snapshot.png')
}

export function getFloorplanSnapshotOverflow(showId) {
  try {
    const raw = fsSync.readFileSync(path.join(floorplansDir(), showId, 'snapshot-meta.json'), 'utf8')
    return JSON.parse(raw).overflow ?? 0
  } catch { return 0 }
}

export async function serveFloorplanImage(imagePath, res) {
  const base = floorplansDir()
  const full = path.resolve(base, imagePath)
  if (!full.startsWith(base + path.sep) && full !== base) return false
  let buffer
  try {
    buffer = await fs.readFile(full)
  } catch {
    return false
  }
  const ext = imagePath.split('.').pop().toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml'
    : ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg'
  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(buffer)
  return true
}

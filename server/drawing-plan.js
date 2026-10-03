// LuxStage/server/drawing-plan.js
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'
import { getTenantId } from './db-context.js'

const ALLOWED_TYPES = ['image/png', 'image/jpeg']

// tenantId ist zu diesem Zeitpunkt bereits über resolveTenantId()/isValidTenantId()
// geprüft (siehe tenant-resolve.js) — hier nur zur Verteidigung in der Tiefe erneut
// validiert, ohne tenants.js zu importieren.
const VALID_TENANT_ID = /^[a-z0-9][a-z0-9-]{1,62}$/

// Mandant: eigener floorplans-Ordner in seinem Mandantenverzeichnis (Verzeichnisname bleibt aus Kompatibilität).
function drawingPlansDir() {
  const tenantId = getTenantId()
  if (!tenantId || !VALID_TENANT_ID.test(tenantId)) throw new Error('Ungültige tenantId')
  return path.join(config.dataPath, 'tenants', tenantId, 'floorplans')
}

export async function saveDrawingPlanImage(templateId, filename, buffer, mimeType) {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error('Ungültiger Dateityp. Erlaubt: PNG, JPG')
  }
  const dir = path.join(drawingPlansDir(), templateId)
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

export async function deleteDrawingPlanImage(imagePath) {
  if (!imagePath) return
  // Traversal-Schutz spiegelt serveDrawingPlanImage(): imagePath ist aktuell
  // nur über layer.image_path/fp.image_path erreichbar, die ausschließlich
  // vom eigenen Rückgabewert von saveDrawingPlanImage gesetzt werden (kein
  // Client kann image_path direkt setzen) — reine Defense-in-Depth, nicht
  // aktiv ausnutzbar, aber die Schwesterfunktion hat denselben Guard.
  const base = drawingPlansDir()
  const full = path.resolve(base, imagePath)
  if (!full.startsWith(base + path.sep)) return
  await fs.unlink(full).catch(() => {})
  // Verzeichnis aufräumen falls leer
  await fs.rmdir(path.dirname(full)).catch(() => {})
}

export function drawingPlanUrl(imagePath) {
  if (!imagePath) return null
  return `/api/drawing-plans/images/${imagePath}`
}

export function resolveDrawingPlanImagePath(imagePath) {
  if (!imagePath) return null
  return path.join(drawingPlansDir(), imagePath)
}

export async function serveDrawingPlanImage(imagePath, res) {
  const base = drawingPlansDir()
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

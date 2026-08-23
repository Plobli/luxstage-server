// LuxStage/server/migrate-tenant-media.js
// Einmalige Migration: verschiebt photos/ und floorplans/ aus dem alten,
// mandantenübergreifend flachen data/-Verzeichnis in die jeweiligen
// Mandantenordner (data/tenants/<id>/photos, data/tenants/<id>/floorplans).
//
// Zuordnung über die Mandanten-DB: Show-Slugs (Photos), Show-IDs und
// Template-IDs (Floorplans) gehören eindeutig zu genau einem Mandanten.
// Ordner, die zu keinem bekannten Mandanten gehören, werden NICHT gelöscht,
// sondern stehen gelassen und am Ende aufgelistet (manuell prüfen).
//
// Aufruf (im Container/auf dem Server mit korrektem DATA_PATH):
//   node server/migrate-tenant-media.js [--dry-run]
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { listTenantIds } from './registry.js'
import { tenantDir, openTenantDb } from './tenants.js'

const dryRun = process.argv.includes('--dry-run')

function moveDir(src, dest) {
  if (!fs.existsSync(src)) return false
  if (fs.existsSync(dest)) {
    console.warn(`  ÜBERSPRUNGEN (Ziel existiert bereits): ${src} -> ${dest}`)
    return false
  }
  console.log(`  ${dryRun ? '[dry-run] ' : ''}${src} -> ${dest}`)
  if (!dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.renameSync(src, dest)
  }
  return true
}

function migrateTenant(tenantId) {
  console.log(`\nMandant: ${tenantId}`)
  const db = openTenantDb(tenantId)
  const shows = db.prepare('SELECT id, slug FROM shows').all()
  const templates = db.prepare('SELECT id FROM templates').all()

  const oldPhotos = path.join(config.dataPath, 'photos')
  const oldFloorplans = path.join(config.dataPath, 'floorplans')
  const newPhotos = path.join(tenantDir(tenantId), 'photos')
  const newFloorplans = path.join(tenantDir(tenantId), 'floorplans')

  const claimed = { photos: new Set(), floorplans: new Set() }

  for (const show of shows) {
    if (moveDir(path.join(oldPhotos, show.slug), path.join(newPhotos, show.slug))) {
      claimed.photos.add(show.slug)
    }
    if (moveDir(path.join(oldFloorplans, show.id), path.join(newFloorplans, show.id))) {
      claimed.floorplans.add(show.id)
    }
  }
  for (const tpl of templates) {
    if (moveDir(path.join(oldFloorplans, tpl.id), path.join(newFloorplans, tpl.id))) {
      claimed.floorplans.add(tpl.id)
    }
  }
  return claimed
}

function main() {
  const tenantIds = listTenantIds()
  if (tenantIds.length === 0) {
    console.log('Keine Mandanten in der Registry gefunden — nichts zu migrieren.')
    return
  }

  console.log(`Migriere Photos/Floorplans für ${tenantIds.length} Mandant(en)...`)
  const claimedAll = { photos: new Set(), floorplans: new Set() }
  for (const tenantId of tenantIds) {
    const claimed = migrateTenant(tenantId)
    for (const slug of claimed.photos) claimedAll.photos.add(slug)
    for (const id of claimed.floorplans) claimedAll.floorplans.add(id)
  }

  // Was übrig bleibt, gehört zu keinem bekannten Mandanten (Waisen-Ordner,
  // z. B. gelöschte Shows). Nur auflisten, nicht anfassen. Im Dry-Run zählen
  // bereits zugeordnete Ordner nicht als übrig, obwohl sie noch am alten Ort liegen.
  for (const [label, dir] of [['photos', path.join(config.dataPath, 'photos')], ['floorplans', path.join(config.dataPath, 'floorplans')]]) {
    if (!fs.existsSync(dir)) continue
    const rest = fs.readdirSync(dir).filter(r => !claimedAll[label].has(r))
    if (rest.length > 0) {
      console.log(`\nNicht zugeordnet in data/${label}/ (manuell prüfen):`)
      for (const r of rest) console.log(`  - ${r}`)
    }
  }

  console.log(dryRun ? '\nDry-Run beendet, nichts wurde verschoben.' : '\nMigration abgeschlossen.')
}

main()

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { after, test } from 'node:test'
import { cleanupDataPath, dataPath } from './helpers/test-env.js'
import { createTenant } from '../tenants.js'
import { runWithDb } from '../db-context.js'

const tdb = createTenant('plan-test')
const inTenant = fn => runWithDb(tdb, fn, 'plan-test')

const { saveDrawingPlanImage, deleteDrawingPlanImage } = await import('../drawing-plan.js')

test('deleteDrawingPlanImage löscht ein regulär gespeichertes Bild', async () => {
  const savedPath = await inTenant(() => saveDrawingPlanImage('tpl-a', 'plan.png', Buffer.from('fake-png'), 'image/png'))
  const full = path.join(dataPath, 'tenants', 'plan-test', 'floorplans', savedPath)
  assert.ok(fsSync.existsSync(full))

  await inTenant(() => deleteDrawingPlanImage(savedPath))
  assert.ok(!fsSync.existsSync(full))
})

test('deleteDrawingPlanImage ignoriert einen Pfad-Traversal-Versuch statt außerhalb des drawing-plans-Verzeichnisses zu löschen', async () => {
  // Kanarienvogel-Datei außerhalb des drawing-plans-Basisverzeichnisses anlegen
  const canaryPath = path.join(dataPath, 'canary.txt')
  await fs.writeFile(canaryPath, 'darf nicht gelöscht werden')

  await inTenant(() => deleteDrawingPlanImage('../canary.txt'))

  assert.ok(fsSync.existsSync(canaryPath), 'Traversal-Pfad darf keine Datei außerhalb des Basisverzeichnisses löschen')
  await fs.unlink(canaryPath)
})

after(cleanupDataPath)

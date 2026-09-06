import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { after, test } from 'node:test'
import { cleanupDataPath, dataPath } from './helpers/test-env.js'

const { saveFloorplanImage, deleteFloorplanImage } = await import('../floorplan.js')

test('deleteFloorplanImage löscht ein regulär gespeichertes Bild', async () => {
  const savedPath = await saveFloorplanImage('tpl-a', 'plan.png', Buffer.from('fake-png'), 'image/png')
  const full = path.join(dataPath, 'floorplans', savedPath)
  assert.ok(fsSync.existsSync(full))

  await deleteFloorplanImage(savedPath)
  assert.ok(!fsSync.existsSync(full))
})

test('deleteFloorplanImage ignoriert einen Pfad-Traversal-Versuch statt außerhalb des floorplans-Verzeichnisses zu löschen', async () => {
  // Kanarienvogel-Datei außerhalb des floorplans-Basisverzeichnisses anlegen
  const canaryPath = path.join(dataPath, 'canary.txt')
  await fs.writeFile(canaryPath, 'darf nicht gelöscht werden')

  await deleteFloorplanImage('../canary.txt')

  assert.ok(fsSync.existsSync(canaryPath), 'Traversal-Pfad darf keine Datei außerhalb des Basisverzeichnisses löschen')
  await fs.unlink(canaryPath)
})

after(cleanupDataPath)

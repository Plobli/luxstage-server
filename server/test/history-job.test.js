import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { cleanupDataPath } from './helpers/test-env.js'

const { runWithDb, getDb } = await import('../db-context.js')
const { dbContainer } = await import('../db-init.js')

// Der History-Job iteriert asynchron über Shows und Mandanten. Der DB-Kontext
// muss dabei über jedes await hinweg erhalten bleiben — sonst schriebe ein
// Mandanten-Snapshot in die globale DB.
test('runWithDb hält den DB-Kontext über await hinweg', async () => {
  const target = dbContainer.db
  await runWithDb(target, async () => {
    assert.equal(getDb(), target)
    await sleep(0)
    assert.equal(getDb(), target, 'Kontext nach await verloren')
    await sleep(0)
    assert.equal(getDb(), target)
  }, 'test-tenant')
})

test('runWithDb gibt das Ergebnis einer async-Funktion zurück', async () => {
  const result = await runWithDb(dbContainer.db, async () => {
    await sleep(0)
    return 'fertig'
  })
  assert.equal(result, 'fertig')
})

after(cleanupDataPath)

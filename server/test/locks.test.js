import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { createShow } = await import('../db/shows.js')
const { acquireLock, releaseLock, getLock, transferLock } = await import('../db/locks.js')
const { getDb } = await import('../db-context.js')
const { config } = await import('../config.js')

const slug = 'lock-test-show'
createShow(slug, { name: 'Lock-Test-Show' })

test('getLock liefert null ohne aktiven Lock', () => {
  assert.equal(getLock(slug), null)
})

test('getLock liefert null für eine unbekannte Show', () => {
  assert.equal(getLock('gibt-es-nicht'), null)
})

test('getLock liefert Inhaber und Zeitpunkt eines aktiven Locks', () => {
  acquireLock(slug, 'anna@test.de')
  const lock = getLock(slug)
  assert.equal(lock.user, 'anna@test.de')
  assert.ok(typeof lock.since === 'number')
})

test('getLock räumt einen abgelaufenen Lock auf und liefert null', () => {
  const show = getDb().prepare('SELECT id FROM shows WHERE slug = ?').get(slug)
  getDb().prepare('UPDATE locks SET since = ? WHERE show_id = ?')
    .run(Date.now() - config.lockTimeout - 1000, show.id)

  assert.equal(getLock(slug), null)
  const remaining = getDb().prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  assert.equal(remaining, undefined, 'abgelaufener Lock wurde nicht gelöscht')
})

test('transferLock übergibt an einen anderen Nutzer', () => {
  acquireLock(slug, 'anna@test.de')
  assert.equal(transferLock(slug, 'anna@test.de', 'bea@test.de'), true)
  assert.equal(getLock(slug).user, 'bea@test.de')
  assert.equal(transferLock(slug, 'anna@test.de', 'cem@test.de'), false)
})

test('acquireLock lehnt fremden aktiven Lock ohne force ab', () => {
  // Lock liegt nach dem vorigen Test bereits bei bea@test.de.
  const result = acquireLock(slug, 'cem@test.de')
  assert.equal(result.ok, false)
  assert.equal(result.lockedBy, 'bea@test.de')
})

test('acquireLock mit force übernimmt einen fremden aktiven Lock', () => {
  const result = acquireLock(slug, 'cem@test.de', { force: true })
  assert.equal(result.ok, true)
  assert.equal(getLock(slug).user, 'cem@test.de')
})

test('releaseLock gibt nur den eigenen Lock frei', () => {
  releaseLock(slug, 'anna@test.de')
  assert.equal(getLock(slug).user, 'cem@test.de')
  releaseLock(slug, 'cem@test.de')
  assert.equal(getLock(slug), null)
})

after(cleanupDataPath)

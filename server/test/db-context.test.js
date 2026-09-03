import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { getDb, getTenantId, hasDbContext, runWithDb } = await import('../db-context.js')
const { dbContainer } = await import('../db-init.js')

// db-context.js wird von 30 Modulen importiert (siehe architecture-analysis-2026-09-03.md,
// F-04) — dieser Test deckt gezielt den Fallback- und Isolationsvertrag ab, da er sonst nur
// implizit über andere DB-Modul-Tests mitläuft.

test('getDb() liefert außerhalb eines Request-Kontexts die globale DB', () => {
  assert.equal(hasDbContext(), false)
  assert.equal(getDb(), dbContainer.db)
})

test('getTenantId() liefert außerhalb eines Kontexts null', () => {
  assert.equal(getTenantId(), null)
})

test('runWithDb() bindet getDb()/getTenantId() innerhalb des Kontexts an die übergebene DB', () => {
  const fakeDb = { marker: 'tenant-db' }
  const result = runWithDb(fakeDb, () => {
    assert.equal(hasDbContext(), true)
    assert.equal(getDb(), fakeDb)
    assert.equal(getTenantId(), 'tenant-a')
    return 'ok'
  }, 'tenant-a')
  assert.equal(result, 'ok')
})

test('nach runWithDb() fällt der Kontext wieder auf die globale DB zurück', () => {
  runWithDb({ marker: 'tenant-db' }, () => {})
  assert.equal(hasDbContext(), false)
  assert.equal(getDb(), dbContainer.db)
  assert.equal(getTenantId(), null)
})

test('parallele runWithDb()-Kontexte isolieren sich gegenseitig (AsyncLocalStorage)', async () => {
  const dbA = { marker: 'a' }
  const dbB = { marker: 'b' }

  async function runIn(db, tenantId, delayMs) {
    return runWithDb(db, async () => {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      // Verzögerung vor der Prüfung: stellt sicher, dass der jeweils andere,
      // parallel laufende Kontext in der Zwischenzeit nicht in diesen hineinleckt.
      assert.equal(getDb(), db)
      assert.equal(getTenantId(), tenantId)
      return tenantId
    }, tenantId)
  }

  const [resultA, resultB] = await Promise.all([
    runIn(dbA, 'tenant-a', 10),
    runIn(dbB, 'tenant-b', 1),
  ])
  assert.equal(resultA, 'tenant-a')
  assert.equal(resultB, 'tenant-b')
})

after(cleanupDataPath)

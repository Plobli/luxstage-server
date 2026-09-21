import assert from 'node:assert/strict'
import { test } from 'node:test'
import './helpers/test-env.js'

const { planScanRoutes } = await import('../routes/plan-scan.js')

test('planScanRoutes gibt null zurück für nicht zuständige Pfade', async () => {
  const result = await planScanRoutes({ method: 'GET' }, {}, '/api/shows/abc/channels')
  assert.equal(result, null)
})

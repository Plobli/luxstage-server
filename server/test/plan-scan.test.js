import assert from 'node:assert/strict'
import { test } from 'node:test'

const { analyzePlanScan, isPdfBuffer } = await import('../plan-scan.js')

test('isPdfBuffer erkennt PDF-Magic-Bytes', () => {
  assert.equal(isPdfBuffer(Buffer.from('%PDF-1.7\n')), true)
  assert.equal(isPdfBuffer(Buffer.from([0xff, 0xd8, 0, 0])), false)
  assert.equal(isPdfBuffer(Buffer.from([0, 0, 0, 0])), false)
})

test('analyzePlanScan nutzt einen injizierten Client statt echtem Anthropic-SDK', async () => {
  const fakeClient = {
    messages: {
      parse: async () => ({ parsed_output: { rows: [{ channel: '1' }], freitext: 'Test' } }),
    },
  }
  const result = await analyzePlanScan([Buffer.from('fake-page')], [], fakeClient)
  assert.deepEqual(result, { rows: [{ channel: '1' }], freitext: 'Test' })
})

test('analyzePlanScan wirft, wenn der Client kein parsed_output liefert', async () => {
  const fakeClient = { messages: { parse: async () => ({ parsed_output: null }) } }
  await assert.rejects(
    () => analyzePlanScan([Buffer.from('fake-page')], [], fakeClient),
    /Einleuchtplan konnte nicht ausgewertet werden/
  )
})

test('analyzePlanScan wirft bei leerem Seiten-Array, ohne den Client aufzurufen', async () => {
  const fakeClient = { messages: { parse: async () => { throw new Error('sollte nie aufgerufen werden') } } }
  await assert.rejects(
    () => analyzePlanScan([], [], fakeClient),
    /Keine PDF-Seiten/
  )
})

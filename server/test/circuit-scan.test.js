import assert from 'node:assert/strict'
import { test } from 'node:test'

const { analyzeCircuitScan, mimeFromBuffer } = await import('../circuit-scan.js')

test('mimeFromBuffer erkennt JPEG/PNG/WebP-Magic-Bytes', () => {
  assert.equal(mimeFromBuffer(Buffer.from([0xff, 0xd8, 0, 0])), 'image/jpeg')
  assert.equal(mimeFromBuffer(Buffer.from([0x89, 0x50, 0, 0])), 'image/png')
  assert.equal(mimeFromBuffer(Buffer.from('RIFFxxxx')), 'image/webp')
  assert.equal(mimeFromBuffer(Buffer.from([0, 0, 0, 0])), 'image/jpeg')
})

test('analyzeCircuitScan nutzt einen injizierten Client statt echtem Anthropic-SDK', async () => {
  const fakeClient = {
    messages: {
      parse: async () => ({ parsed_output: { rows: [{ channel: '1' }] } }),
    },
  }
  const result = await analyzeCircuitScan(Buffer.from([0xff, 0xd8]), [], fakeClient)
  assert.deepEqual(result, { rows: [{ channel: '1' }] })
})

test('analyzeCircuitScan wirft, wenn der Client kein parsed_output liefert', async () => {
  const fakeClient = { messages: { parse: async () => ({ parsed_output: null }) } }
  await assert.rejects(
    () => analyzeCircuitScan(Buffer.from([0xff, 0xd8]), [], fakeClient),
    /Kreisliste konnte nicht ausgewertet werden/
  )
})

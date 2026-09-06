import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'

const { analyzeCircuitScan, mimeFromBuffer } = await import('../circuit-scan.js')

// Echte, minimale Bilddaten statt bloßer Magic-Bytes — analyzeCircuitScan
// verifiziert den Inhalt jetzt per sharp() statt nur die ersten Bytes zu lesen.
const validImageBuffer = await sharp({
  create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
}).jpeg().toBuffer()

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
  const result = await analyzeCircuitScan(validImageBuffer, [], fakeClient)
  assert.deepEqual(result, { rows: [{ channel: '1' }] })
})

test('analyzeCircuitScan wirft, wenn der Client kein parsed_output liefert', async () => {
  const fakeClient = { messages: { parse: async () => ({ parsed_output: null }) } }
  await assert.rejects(
    () => analyzeCircuitScan(validImageBuffer, [], fakeClient),
    /Kreisliste konnte nicht ausgewertet werden/
  )
})

test('analyzeCircuitScan lehnt Nicht-Bild-Daten ab, statt sie stillschweigend als JPEG an die Vision-API zu senden', async () => {
  const fakeClient = { messages: { parse: async () => { throw new Error('sollte nie aufgerufen werden') } } }
  await assert.rejects(
    () => analyzeCircuitScan(Buffer.from([0, 0, 0, 0]), [], fakeClient),
    /kein gültiges Bild/
  )
})

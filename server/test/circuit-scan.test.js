import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mimeFromBuffer } from '../circuit-scan.js'

test('mimeFromBuffer erkennt JPEG/PNG/WebP-Signaturen, Fallback JPEG', () => {
  assert.equal(mimeFromBuffer(Buffer.from([0xff, 0xd8])), 'image/jpeg')
  assert.equal(mimeFromBuffer(Buffer.from([0x89, 0x50])), 'image/png')
  assert.equal(mimeFromBuffer(Buffer.from('RIFF....WEBP')), 'image/webp')
  assert.equal(mimeFromBuffer(Buffer.from([0x00, 0x00])), 'image/jpeg')
})

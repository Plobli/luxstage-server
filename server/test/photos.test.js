import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import './helpers/test-env.js'
import { parseMultipart } from '../photos.js'

test('Multipart-Upload wird in eine temporäre Datei gestreamt und aufgeräumt', async () => {
  const boundary = 'LuxStageTestBoundary'
  const payload = Buffer.from('small-photo-payload')
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="stage.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    payload,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  const request = Readable.from([body])
  request.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` }

  const upload = await parseMultipart(request)
  try {
    assert.equal(upload.files.length, 1)
    assert.equal(upload.files[0].filename, 'stage.jpg')
    assert.deepEqual(await fs.readFile(upload.files[0].path), payload)
  } finally {
    const uploadDir = path.dirname(upload.files[0].path)
    await upload.cleanup()
    await assert.rejects(fs.access(uploadDir))
  }
})
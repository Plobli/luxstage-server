import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import './helpers/test-env.js'
import { readJsonBody, uploadErrorStatus } from '../helpers.js'

test('uploadErrorStatus erkennt Größen-/Mengen-Fehler als 413', () => {
  assert.equal(uploadErrorStatus('Datei zu groß'), 413)
  assert.equal(uploadErrorStatus('zu viele Dateien'), 413)
  assert.equal(uploadErrorStatus('ungültiger Dateityp'), 400)
  assert.equal(uploadErrorStatus(undefined), 400)
})

function jsonReq(raw) {
  const req = Readable.from([Buffer.from(raw)])
  return req
}

function fakeRes() {
  let status = null
  let body = null
  return {
    writeHead(code) { status = code },
    end(content) { body = content ? JSON.parse(content) : null },
    get status() { return status },
    get body() { return body },
  }
}

test('readJsonBody liefert {} bei leerem Body', async () => {
  const result = await readJsonBody(jsonReq(''), fakeRes())
  assert.deepEqual(result, {})
})

test('readJsonBody parst gültiges JSON', async () => {
  const result = await readJsonBody(jsonReq('{"a":1}'), fakeRes())
  assert.deepEqual(result, { a: 1 })
})

test('readJsonBody liefert 400 und null bei ungültigem JSON', async () => {
  const res = fakeRes()
  const result = await readJsonBody(jsonReq('{kaputt'), res)
  assert.equal(result, null)
  assert.equal(res.status, 400)
  assert.equal(res.body.error, 'Ungültiger JSON-Body')
})

test('readJsonBody liefert 413 und null bei zu großem Body', async () => {
  const res = fakeRes()
  const result = await readJsonBody(jsonReq('{"a":"' + 'x'.repeat(100) + '"}'), res, 10)
  assert.equal(result, null)
  assert.equal(res.status, 413)
})

import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import './helpers/test-env.js'
import { readJsonBody, uploadErrorStatus, clientIp } from '../helpers.js'

process.env.TRUST_PROXY = 'true'
const { config } = await import('../config.js')
config.trustProxy = true

test('clientIp nimmt bei trustProxy den letzten X-Forwarded-For-Eintrag (Anti-Spoofing)', () => {
  const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: {} }
  assert.equal(clientIp(req), '5.6.7.8')
})

test('clientIp nimmt den einzigen Eintrag, falls kein Proxy-Hop dazwischenliegt', () => {
  const req = { headers: { 'x-forwarded-for': '9.9.9.9' }, socket: {} }
  assert.equal(clientIp(req), '9.9.9.9')
})

test('clientIp faellt ohne X-Forwarded-For auf die Socket-Adresse zurueck', () => {
  const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } }
  assert.equal(clientIp(req), '127.0.0.1')
})

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

test('readJsonBody lehnt übermäßig tief verschachteltes JSON ab', async () => {
  let deeplyNested = 'null'
  for (let i = 0; i < 100; i++) deeplyNested = `{"a":${deeplyNested}}`
  const res = fakeRes()
  const result = await readJsonBody(jsonReq(deeplyNested), res)
  assert.equal(result, null)
  assert.equal(res.status, 400)
  assert.equal(res.body.error, 'JSON-Body zu tief verschachtelt')
})

test('readJsonBody akzeptiert realistisch verschachteltes JSON (z.B. Tiptap-Content)', async () => {
  let nested = '"text"'
  for (let i = 0; i < 20; i++) nested = `{"type":"listItem","content":[${nested}]}`
  const res = fakeRes()
  const result = await readJsonBody(jsonReq(nested), res)
  assert.notEqual(result, null)
})

test('readJsonBody liefert 413 und null bei zu großem Body', async () => {
  const res = fakeRes()
  const result = await readJsonBody(jsonReq('{"a":"' + 'x'.repeat(100) + '"}'), res, 10)
  assert.equal(result, null)
  assert.equal(res.status, 413)
})

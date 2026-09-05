import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { createTransport } = await import('../email.js')

test('createTransport liefert null ohne Host, ruft die injizierte Factory nicht auf', () => {
  const createFn = () => { throw new Error('sollte nicht aufgerufen werden') }
  assert.equal(createTransport({}, createFn), null)
  assert.equal(createTransport(null, createFn), null)
})

test('createTransport nutzt eine injizierte Factory statt echtem nodemailer.createTransport', () => {
  let capturedOptions
  const fakeTransport = { marker: 'fake' }
  const createFn = (opts) => { capturedOptions = opts; return fakeTransport }

  const result = createTransport({ host: 'smtp.example.com', port: 587, secure: false, user: 'u', pass: 'p', from: 'a@b.c' }, createFn)

  assert.equal(result, fakeTransport)
  assert.equal(capturedOptions.host, 'smtp.example.com')
  assert.equal(capturedOptions.family, 4)
  assert.equal(capturedOptions.connectionTimeout, 10_000)
})

after(cleanupDataPath)

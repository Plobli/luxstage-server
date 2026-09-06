import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applySecurityHeaders } from '../security-headers.js'

function fakeRes() {
  const headers = {}
  return { setHeader: (k, v) => { headers[k] = v }, headers }
}

test('applySecurityHeaders setzt HSTS außerhalb von Dev-Modus', () => {
  const res = fakeRes()
  applySecurityHeaders(res, false)
  assert.equal(res.headers['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains')
})

test('applySecurityHeaders setzt kein HSTS im Dev-Modus (kein echtes HTTPS)', () => {
  const res = fakeRes()
  applySecurityHeaders(res, true)
  assert.equal(res.headers['Strict-Transport-Security'], undefined)
})

test('applySecurityHeaders setzt eine restriktive Permissions-Policy', () => {
  const res = fakeRes()
  applySecurityHeaders(res)
  assert.match(res.headers['Permissions-Policy'], /camera=\(\)/)
  assert.match(res.headers['Permissions-Policy'], /microphone=\(\)/)
  assert.match(res.headers['Permissions-Policy'], /geolocation=\(\)/)
})

test('CSP enthält frame-ancestors none (redundant zu X-Frame-Options)', () => {
  const res = fakeRes()
  applySecurityHeaders(res)
  assert.match(res.headers['Content-Security-Policy'], /frame-ancestors 'none'/)
})

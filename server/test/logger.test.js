import assert from 'node:assert/strict'
import { test } from 'node:test'
import { logger } from '../logger.js'

/** Fängt console.log/error während fn() ab. */
function capture(fn) {
  const lines = { out: [], err: [] }
  const origLog = console.log
  const origErr = console.error
  console.log = l => lines.out.push(l)
  console.error = l => lines.err.push(l)
  try { fn() } finally { console.log = origLog; console.error = origErr }
  return lines
}

test('Log-Zeile enthält Zeitstempel, Level, Scope und Nachricht', () => {
  const { out } = capture(() => logger('auth').info('Login erfolgreich'))
  assert.equal(out.length, 1)
  assert.match(out[0], /^\d{4}-\d{2}-\d{2}T[\d:.]+Z INFO \[auth\] Login erfolgreich$/)
})

test('Felder werden als key=value angehängt', () => {
  const { out } = capture(() => logger('auth').warn('Login fehlgeschlagen', { user: 'a@b.de', ip: '127.0.0.1' }))
  assert.match(out[0], /WARN \[auth\] Login fehlgeschlagen user=a@b\.de ip=127\.0\.0\.1$/)
})

test('Werte mit Leerraum werden gequotet, damit key=value lesbar bleibt', () => {
  const { out } = capture(() => logger('x').info('Test', { grund: 'zwei Wörter' }))
  assert.match(out[0], /grund="zwei Wörter"$/)
})

test('error schreibt nach stderr, die übrigen Level nach stdout', () => {
  const { out, err } = capture(() => {
    const log = logger('x')
    log.error('kaputt')
    log.warn('achtung')
    log.info('hinweis')
  })
  assert.equal(err.length, 1)
  assert.match(err[0], /ERROR \[x\] kaputt/)
  assert.equal(out.length, 2)
})

test('debug wird beim Standard-Level info unterdrückt', () => {
  const { out, err } = capture(() => logger('x').debug('details'))
  assert.equal(out.length + err.length, 0)
})

test('fehlende und leere Feldwerte brechen die Ausgabe nicht', () => {
  const { out } = capture(() => logger('x').info('Test', { a: null, b: undefined, c: 0 }))
  assert.match(out[0], /a= b= c=0$/)
})

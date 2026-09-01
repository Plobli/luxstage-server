import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidEmail, PASSWORD_MIN_LENGTH } from '../../shared/constants.js'

test('isValidEmail akzeptiert gültige Adressen', () => {
  assert.ok(isValidEmail('a@b.de'))
  assert.ok(isValidEmail('vorname.nachname@theater-beispiel.example'))
})

test('isValidEmail trimmt Leerraum', () => {
  assert.ok(isValidEmail('  a@b.de  '))
})

test('isValidEmail lehnt ungültige Werte ab', () => {
  for (const v of ['', null, undefined, 'ohne-at', 'a@b', 'a b@c.de', 'a@@b.de']) {
    assert.equal(isValidEmail(v), false, `sollte ungültig sein: ${v}`)
  }
})

test('PASSWORD_MIN_LENGTH ist gesetzt', () => {
  assert.equal(typeof PASSWORD_MIN_LENGTH, 'number')
  assert.ok(PASSWORD_MIN_LENGTH >= 8)
})

import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { getDb } = await import('../db-context.js')
const { setSecretSetting, getSecretSetting, getSetting } = await import('../db/settings.js')
const { createResetToken, takeResetToken } = await import('../db/users.js')

test('setSecretSetting verschlüsselt den Wert at rest', () => {
  setSecretSetting('smtp.pass', 'geheimes-passwort')
  const raw = getSetting('smtp.pass')
  assert.ok(raw.startsWith('v1:'))
  assert.ok(!raw.includes('geheimes-passwort'))
  assert.equal(getSecretSetting('smtp.pass'), 'geheimes-passwort')
})

test('setSecretSetting mit leerem Wert löscht das Secret', () => {
  setSecretSetting('smtp.pass', 'wert')
  setSecretSetting('smtp.pass', '')
  assert.equal(getSecretSetting('smtp.pass'), '')
})

test('Reset-Token wird gehasht gespeichert, nicht im Klartext', () => {
  const token = 'raw-reset-token-123'
  createResetToken(token, 'user@example.test', 60_000)
  const row = getDb().prepare('SELECT token FROM password_resets WHERE username = ?').get('user@example.test')
  assert.notEqual(row.token, token)
  assert.equal(takeResetToken(token), 'user@example.test')
  // einmalig einlösbar
  assert.equal(takeResetToken(token), null)
})

test('Ein abgelaufener Reset-Token wird nicht akzeptiert', () => {
  const token = 'expired-token-456'
  createResetToken(token, 'user2@example.test', -1)
  assert.equal(takeResetToken(token), null)
})

after(() => cleanupDataPath())

import assert from 'node:assert/strict'
import { after, test } from 'node:test'

// SETTINGS_ENC_KEY muss vor jedem Import von config.js/db/settings.js gesetzt
// sein, da der abgeleitete Schlüssel als Modul-Level-Konstante berechnet
// wird — auch vor dem test-env.js-Helper, der config.js bereits importiert.
process.env.SETTINGS_ENC_KEY = 'separates-settings-secret-mindestens-32-zeichen'
const { cleanupDataPath } = await import('./helpers/test-env.js')
const { config } = await import('../config.js')
const { setSecretSetting, getSecretSetting } = await import('../db/settings.js')

test('SETTINGS_ENC_KEY wird als eigener Schlüssel für die Settings-Verschlüsselung verwendet, nicht JWT_SECRET', () => {
  assert.equal(config.settingsEncKey, 'separates-settings-secret-mindestens-32-zeichen')
  assert.notEqual(config.settingsEncKey, config.jwtSecret)

  setSecretSetting('smtp.pass', 'geheimes-passwort')
  assert.equal(getSecretSetting('smtp.pass'), 'geheimes-passwort')
})

after(cleanupDataPath)

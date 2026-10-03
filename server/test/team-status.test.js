import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeTeamStatus, teamAccessDenial, TRIAL_DAYS } from '../team-status.js'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 9, 1)

test('Team ohne Eintrag oder ohne Zeiträume hat dauerhaft vollen Zugang (Bestand)', () => {
  assert.equal(computeTeamStatus(null, T0).state, 'active')
  assert.equal(computeTeamStatus({ trial_ends_at: null, paid_until: null }, T0).state, 'active')
})

test('Nach dem Testzeitraum ist ein Team dauerhaft nur lesbar, nie gesperrt', () => {
  const team = { trial_ends_at: T0 + TRIAL_DAYS * DAY, paid_until: null }
  assert.equal(computeTeamStatus(team, T0).state, 'trial')
  assert.equal(computeTeamStatus(team, team.trial_ends_at).state, 'trial')
  assert.equal(computeTeamStatus(team, team.trial_ends_at + DAY).state, 'readonly')
  assert.equal(computeTeamStatus(team, team.trial_ends_at + 5 * 365 * DAY).state, 'readonly')
})

test('Bezahlter Zeitraum verlängert den Zugang und gilt als active', () => {
  const team = { trial_ends_at: T0, paid_until: T0 + 30 * DAY }
  assert.equal(computeTeamStatus(team, T0 + 10 * DAY).state, 'active')
  assert.equal(computeTeamStatus(team, T0 + 31 * DAY).state, 'readonly')
})

test('readonly erlaubt Lesen und Login, blockt Schreiben', () => {
  const readonly = { state: 'readonly' }
  assert.equal(teamAccessDenial(readonly, 'GET', '/api/shows'), null)
  assert.equal(teamAccessDenial(readonly, 'POST', '/api/auth/login'), null)
  assert.equal(teamAccessDenial(readonly, 'POST', '/api/shows').code, 'TEAM_READONLY')
  assert.equal(teamAccessDenial({ state: 'trial' }, 'POST', '/api/shows'), null)
})

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import './helpers/test-env.js'

const { subscribe, broadcast, getPresence, _clientMapSize, closeAllConnections } = await import('../sse.js')

function fakeResponse() {
  const res = new EventEmitter()
  res.writeHead = () => {}
  res.write = () => true
  res.end = () => {}
  return res
}

test('subscribe legt einen Client-Map-Eintrag für die Show an', () => {
  const before = _clientMapSize()
  subscribe('show-a', fakeResponse(), 'anna', 'web', null)
  assert.equal(_clientMapSize(), before + 1)
})

test('res.on("close") entfernt den äußeren Map-Eintrag vollständig, statt nur die innere Map zu leeren', () => {
  const before = _clientMapSize()
  const res = fakeResponse()
  subscribe('show-b', res, 'anna', 'web', null)
  assert.equal(_clientMapSize(), before + 1)

  res.emit('close')
  assert.equal(_clientMapSize(), before, 'der äußere Key für show-b darf nach dem letzten Disconnect nicht mehr existieren')
  assert.deepEqual(getPresence('show-b'), [])
})

test('mehrere Clients derselben Show: erst nach dem letzten Disconnect verschwindet der Key', () => {
  const before = _clientMapSize()
  const res1 = fakeResponse()
  const res2 = fakeResponse()
  subscribe('show-c', res1, 'anna', 'web', null)
  subscribe('show-c', res2, 'bea', 'web', null)
  assert.equal(_clientMapSize(), before + 1)

  res1.emit('close')
  assert.equal(_clientMapSize(), before + 1, 'solange noch ein Client offen ist, bleibt der Key bestehen')

  res2.emit('close')
  assert.equal(_clientMapSize(), before, 'nach dem letzten Disconnect muss der Key verschwinden')
})

test('broadcast auf eine Show ohne (mehr) offene Clients wirft nicht', () => {
  const res = fakeResponse()
  subscribe('show-d', res, 'anna', 'web', null)
  res.emit('close')
  assert.doesNotThrow(() => broadcast('show-d', 'channels-updated', {}))
})

test('closeAllConnections beendet alle offenen Clients mit einem letzten Event und leert die Client-Map', () => {
  const res1 = fakeResponse()
  const res2 = fakeResponse()
  let ended1 = false, ended2 = false
  res1.end = () => { ended1 = true }
  res2.end = () => { ended2 = true }
  subscribe('show-e', res1, 'anna', 'web', null)
  subscribe('show-f', res2, 'bea', 'web', null)

  closeAllConnections()

  assert.ok(ended1 && ended2)
  assert.equal(_clientMapSize(), 0)
})

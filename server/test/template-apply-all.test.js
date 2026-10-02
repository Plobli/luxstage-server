import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { writeTemplate } = await import('../db/templates.js')
const { writeTemplateBatten } = await import('../db/template-battens.js')
const { createShow, readShow } = await import('../db/shows.js')
const { applyTemplateToAllShows } = await import('../db/template-apply-to-show.js')
const { acquireLock } = await import('../db/locks.js')

test('applyTemplateToAllShows übernimmt neue Template-Battens in alle Shows mit diesem Template', async () => {
  writeTemplate('tpl-apply-all', [])
  writeTemplateBatten('tpl-apply-all', { name: 'Zug 1', batten_nr: '1', length_cm: 800, sort_order: 0 })

  createShow('show-apply-all-a', { name: 'Show A', template: 'tpl-apply-all', importSections: false })
  createShow('show-apply-all-b', { name: 'Show B', template: 'tpl-apply-all', importSections: false })
  createShow('show-apply-all-other', { name: 'Show ohne Template', importSections: false })

  const stats = await applyTemplateToAllShows('tpl-apply-all', 'battens')

  assert.equal(stats.shows, 2, 'nur Shows mit diesem Template werden gezählt')
  assert.equal(stats.battensAdded, 2)

  const showA = readShow('show-apply-all-a')
  const battensA = (await import('../db-context.js')).getDb()
    .prepare('SELECT name FROM battens WHERE show_id = ?').all(showA.id)
  assert.deepEqual(battensA.map(b => b.name), ['Zug 1'])
})

test('applyTemplateToAllShows ist idempotent — ein zweiter Lauf fügt nichts erneut hinzu', async () => {
  const stats = await applyTemplateToAllShows('tpl-apply-all', 'battens')
  assert.equal(stats.battensAdded, 0)
})

test('applyTemplateToAllShows wirft bei unbekanntem Template', async () => {
  await assert.rejects(applyTemplateToAllShows('gibt-es-nicht', 'battens'), /nicht gefunden/)
})

test('applyTemplateToAllShows überspringt gesperrte Shows statt den Lock zu umgehen', async () => {
  writeTemplate('tpl-apply-locked', [])
  writeTemplateBatten('tpl-apply-locked', { name: 'Zug L', batten_nr: '1', length_cm: 800, sort_order: 0 })

  createShow('show-apply-locked', { name: 'Locked Show', template: 'tpl-apply-locked', importSections: false })
  createShow('show-apply-unlocked', { name: 'Unlocked Show', template: 'tpl-apply-locked', importSections: false })
  acquireLock('show-apply-locked', 'editor-a')

  const stats = await applyTemplateToAllShows('tpl-apply-locked', 'battens')

  assert.deepEqual(stats.skippedLockedShows, ['show-apply-locked'])
  assert.equal(stats.battensAdded, 1, 'nur die ungesperrte Show wurde geändert')

  const lockedShow = readShow('show-apply-locked')
  const battensLocked = (await import('../db-context.js')).getDb()
    .prepare('SELECT name FROM battens WHERE show_id = ?').all(lockedShow.id)
  assert.deepEqual(battensLocked, [], 'gesperrte Show blieb unverändert')
})

after(cleanupDataPath)

import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { writeTemplate } = await import('../db/templates.js')
const { writeTemplateBar } = await import('../db/template-bars.js')
const { createShow, readShow } = await import('../db/shows.js')
const { applyTemplateToAllShows } = await import('../db/template-apply.js')

test('applyTemplateToAllShows übernimmt neue Template-Bars in alle Shows mit diesem Template', async () => {
  writeTemplate('tpl-apply-all', [])
  writeTemplateBar('tpl-apply-all', { name: 'Zug 1', zug_nr: '1', length_cm: 800, sort_order: 0 })

  createShow('show-apply-all-a', { name: 'Show A', template: 'tpl-apply-all', importSections: false })
  createShow('show-apply-all-b', { name: 'Show B', template: 'tpl-apply-all', importSections: false })
  createShow('show-apply-all-other', { name: 'Show ohne Template', importSections: false })

  const stats = await applyTemplateToAllShows('tpl-apply-all', 'bars')

  assert.equal(stats.shows, 2, 'nur Shows mit diesem Template werden gezählt')
  assert.equal(stats.barsAdded, 2)

  const showA = readShow('show-apply-all-a')
  const barsA = (await import('../db-context.js')).getDb()
    .prepare('SELECT name FROM bars WHERE show_id = ?').all(showA.id)
  assert.deepEqual(barsA.map(b => b.name), ['Zug 1'])
})

test('applyTemplateToAllShows ist idempotent — ein zweiter Lauf fügt nichts erneut hinzu', async () => {
  const stats = await applyTemplateToAllShows('tpl-apply-all', 'bars')
  assert.equal(stats.barsAdded, 0)
})

test('applyTemplateToAllShows wirft bei unbekanntem Template', async () => {
  await assert.rejects(applyTemplateToAllShows('gibt-es-nicht', 'bars'), /nicht gefunden/)
})

after(cleanupDataPath)

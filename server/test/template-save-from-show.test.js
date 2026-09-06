import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import './helpers/test-env.js'

const { getDb } = await import('../db-context.js')
const { createShow } = await import('../db/shows.js')
const { writeBar } = await import('../db/bars.js')
const { writeTower } = await import('../db/towers.js')
const { writeTemplate } = await import('../db/templates.js')
const { saveShowItemsToTemplate } = await import('../db/template-save-from-show.js')
const { showRoutes } = await import('../routes/shows.js')

function templateBarsByName(templateName) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  return getDb().prepare('SELECT * FROM template_bars WHERE template_id = ?').all(tpl.id)
}

function templateTowersByName(templateName) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  return getDb().prepare('SELECT * FROM template_towers WHERE template_id = ?').all(tpl.id)
}

test('saveShowItemsToTemplate führt zwei gleichnamige Show-Bars zu einem Template-Eintrag zusammen statt Duplikate anzulegen', () => {
  createShow('to-template-dup-bars', { name: 'Dup-Bars-Test', importSections: false })
  writeTemplate('tpl-dup-bars', [])
  const bar1 = writeBar('to-template-dup-bars', { name: 'Zugstange 1' })
  const bar2 = writeBar('to-template-dup-bars', { name: 'Zugstange 1' }) // bewusst gleicher Name, andere id

  saveShowItemsToTemplate('tpl-dup-bars', 'to-template-dup-bars', 'bars', [bar1, bar2], {}, null)

  const tplBars = templateBarsByName('tpl-dup-bars')
  assert.equal(tplBars.length, 1, 'zwei gleichnamige Show-Bars dürfen nur einen Template-Eintrag erzeugen')
  assert.equal(tplBars[0].name, 'Zugstange 1')
})

test('saveShowItemsToTemplate führt zwei gleichnamige Show-Towers zu einem Template-Eintrag zusammen statt Duplikate anzulegen', () => {
  createShow('to-template-dup-towers', { name: 'Dup-Towers-Test', importSections: false })
  writeTemplate('tpl-dup-towers', [])
  const tower1 = writeTower('to-template-dup-towers', { name: 'Turm A', slot_count: 4 })
  const tower2 = writeTower('to-template-dup-towers', { name: 'Turm A', slot_count: 4 })

  saveShowItemsToTemplate('tpl-dup-towers', 'to-template-dup-towers', 'towers', [tower1, tower2], {}, null)

  const tplTowers = templateTowersByName('tpl-dup-towers')
  assert.equal(tplTowers.length, 1, 'zwei gleichnamige Show-Towers dürfen nur einen Template-Eintrag erzeugen')
})

function jsonRequest(method, user, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = method
  req.user = user
  req.headers = { 'content-type': 'application/json' }
  return req
}

function createResponseLocal() {
  let status = null, body = null
  return {
    writeHead(code) { status = code },
    end(content) { body = content ? JSON.parse(content) : null },
    get status() { return status },
    get body() { return body },
  }
}

test('POST /api/shows/:slug/to-template lehnt overrideName bei mehr als einem ausgewählten Element mit 400 ab', async () => {
  createShow('to-template-override-multi', { name: 'Override-Multi-Test', importSections: false })
  writeTemplate('tpl-override-multi', [])
  const bar1 = writeBar('to-template-override-multi', { name: 'A' })
  const bar2 = writeBar('to-template-override-multi', { name: 'B' })

  const res = createResponseLocal()
  await showRoutes(
    jsonRequest('POST', { username: 'tester' }, {
      templateName: 'tpl-override-multi', scope: 'bars', selectedIds: [bar1, bar2], overrideName: 'Kollision',
    }),
    res,
    '/api/shows/to-template-override-multi/to-template'
  )

  assert.equal(res.status, 400)
  assert.equal(templateBarsByName('tpl-override-multi').length, 0, 'bei abgelehnter Anfrage darf kein Template-Eintrag entstehen')
})

test('POST /api/shows/:slug/to-template erlaubt overrideName bei genau einem ausgewählten Element', async () => {
  createShow('to-template-override-single', { name: 'Override-Single-Test', importSections: false })
  writeTemplate('tpl-override-single', [])
  const bar1 = writeBar('to-template-override-single', { name: 'Original' })

  const res = createResponseLocal()
  await showRoutes(
    jsonRequest('POST', { username: 'tester' }, {
      templateName: 'tpl-override-single', scope: 'bars', selectedIds: [bar1], overrideName: 'Umbenannt',
    }),
    res,
    '/api/shows/to-template-override-single/to-template'
  )

  assert.equal(res.status, 200)
  const tplBars = templateBarsByName('tpl-override-single')
  assert.equal(tplBars.length, 1)
  assert.equal(tplBars[0].name, 'Umbenannt')
})

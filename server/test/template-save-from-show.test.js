import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import './helpers/test-env.js'

const { getDb } = await import('../db-context.js')
const { createShow } = await import('../db/shows.js')
const { writeBatten } = await import('../db/battens.js')
const { writeTower } = await import('../db/towers.js')
const { writeTemplate } = await import('../db/templates.js')
const { saveShowItemsToTemplate } = await import('../db/template-save-from-show.js')
const { showRoutes } = await import('../routes/shows.js')

function templateBattensByName(templateName) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  return getDb().prepare('SELECT * FROM template_battens WHERE template_id = ?').all(tpl.id)
}

function templateTowersByName(templateName) {
  const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(templateName)
  return getDb().prepare('SELECT * FROM template_towers WHERE template_id = ?').all(tpl.id)
}

test('saveShowItemsToTemplate führt zwei gleichnamige Show-Battens zu einem Template-Eintrag zusammen statt Duplikate anzulegen', () => {
  createShow('to-template-dup-battens', { name: 'Dup-Battens-Test', importSections: false })
  writeTemplate('tpl-dup-battens', [])
  const batten1 = writeBatten('to-template-dup-battens', { name: 'Batten 1' })
  const batten2 = writeBatten('to-template-dup-battens', { name: 'Batten 1' }) // bewusst gleicher Name, andere id

  saveShowItemsToTemplate('tpl-dup-battens', 'to-template-dup-battens', 'battens', [batten1, batten2], {}, null)

  const tplBattens = templateBattensByName('tpl-dup-battens')
  assert.equal(tplBattens.length, 1, 'zwei gleichnamige Show-Battens dürfen nur einen Template-Eintrag erzeugen')
  assert.equal(tplBattens[0].name, 'Batten 1')
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
  const batten1 = writeBatten('to-template-override-multi', { name: 'A' })
  const batten2 = writeBatten('to-template-override-multi', { name: 'B' })

  const res = createResponseLocal()
  await showRoutes(
    jsonRequest('POST', { username: 'tester' }, {
      templateName: 'tpl-override-multi', scope: 'battens', selectedIds: [batten1, batten2], overrideName: 'Kollision',
    }),
    res,
    '/api/shows/to-template-override-multi/to-template'
  )

  assert.equal(res.status, 400)
  assert.equal(templateBattensByName('tpl-override-multi').length, 0, 'bei abgelehnter Anfrage darf kein Template-Eintrag entstehen')
})

test('POST /api/shows/:slug/to-template erlaubt overrideName bei genau einem ausgewählten Element', async () => {
  createShow('to-template-override-single', { name: 'Override-Single-Test', importSections: false })
  writeTemplate('tpl-override-single', [])
  const batten1 = writeBatten('to-template-override-single', { name: 'Original' })

  const res = createResponseLocal()
  await showRoutes(
    jsonRequest('POST', { username: 'tester' }, {
      templateName: 'tpl-override-single', scope: 'battens', selectedIds: [batten1], overrideName: 'Umbenannt',
    }),
    res,
    '/api/shows/to-template-override-single/to-template'
  )

  assert.equal(res.status, 200)
  const tplBattens = templateBattensByName('tpl-override-single')
  assert.equal(tplBattens.length, 1)
  assert.equal(tplBattens[0].name, 'Umbenannt')
})

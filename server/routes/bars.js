import * as db from '../db.js'
import { restoreBars } from '../db/bars.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'
import { recordOperation, clearRedo } from '../db/operations.js'

const SHOW_BARS         = /^\/api\/shows\/([^/]+)\/bars$/
const SHOW_BARS_RESTORE = /^\/api\/shows\/([^/]+)\/bars\/restore$/
const SHOW_BARS_REORDER = /^\/api\/shows\/([^/]+)\/bars\/reorder$/
const SHOW_BAR          = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)$/
const SHOW_BAR_FIXTURE  = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)\/fixtures$/
const SHOW_BAR_FIX_ONE  = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)\/fixtures\/([^/]+)$/

// Jede Bar-Aktion (anlegen, ändern, löschen, Fixture zuweisen/ändern/entfernen,
// reorder, restore) zeichnet den kompletten Bars-Zustand der Show auf —
// konsistent mit dem "ein Eintrag pro Save"-Modell der übrigen Ressourcen
// (siehe recordTowersOperation in towers.js für dasselbe Muster).
function recordBarsOperation(show, user, oldBars, newBars) {
  if (!show || !user) return
  recordOperation(show.id, user.username, 'bars', oldBars, newBars)
  clearRedo(show.id)
}

export async function barRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_BARS_RESTORE.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = db.readShow(slug)
      const oldBars = db.readBars(slug)
      restoreBars(slug, body.bars ?? [])
      recordBarsOperation(show, user, oldBars, body.bars ?? [])
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_BARS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') return json(res, 200, db.readBars(slug))
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = db.readShow(slug)
      const oldBars = db.readBars(slug)
      const barId = db.writeBar(slug, body)
      recordBarsOperation(show, user, oldBars, db.readBars(slug))
      broadcast(slug, 'bars-updated', {})
      return json(res, 201, { id: barId })
    }
  }

  if (m = SHOW_BARS_REORDER.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = db.readShow(slug)
      const oldBars = db.readBars(slug)
      db.reorderBars(slug, body.order ?? [])
      recordBarsOperation(show, user, oldBars, db.readBars(slug))
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_BAR.exec(pathname)) {
    const slug = m[1]; const barId = m[2]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = db.readShow(slug)
      const oldBars = db.readBars(slug)
      db.writeBar(slug, { ...body, id: barId })
      recordBarsOperation(show, user, oldBars, db.readBars(slug))
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = db.readShow(slug)
      const oldBars = db.readBars(slug)
      db.deleteBar(barId)
      recordBarsOperation(show, user, oldBars, db.readBars(slug))
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_BAR_FIXTURE.exec(pathname)) {
    const slug = m[1]; const barId = m[2]
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId, position, notes, fixtureId, side, positionText } = body
      if (!channelId) return json(res, 400, { error: 'channelId erforderlich' })
      const show = db.readShow(slug)
      const oldBars = db.readBars(slug)
      const id = db.writeBarFixture(barId, channelId, position ?? 0, notes ?? '', fixtureId ?? null, side ?? 'out', positionText ?? '')
      recordBarsOperation(show, user, oldBars, db.readBars(slug))
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true, id })
    }
  }

  if (m = SHOW_BAR_FIX_ONE.exec(pathname)) {
    const slug = m[1]; const barId = m[2]; const fixtureId = m[3]
    if (method === 'PATCH') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = db.readShow(slug)
      const oldBars = db.readBars(slug)
      db.updateBarFixtureNotes(fixtureId, body.notes ?? '')
      recordBarsOperation(show, user, oldBars, db.readBars(slug))
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = db.readShow(slug)
      const oldBars = db.readBars(slug)
      db.removeBarFixture(fixtureId)
      recordBarsOperation(show, user, oldBars, db.readBars(slug))
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  return null
}

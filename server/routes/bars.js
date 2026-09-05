import { deleteBar, readBars, removeBarFixture, reorderBars, restoreBars, updateBarFixtureNotes, writeBar, writeBarFixture } from '../db/bars.js'
import { readJsonBody, json, withShowMutation } from '../helpers.js'

const SHOW_BARS         = /^\/api\/shows\/([^/]+)\/bars$/
const SHOW_BARS_RESTORE = /^\/api\/shows\/([^/]+)\/bars\/restore$/
const SHOW_BARS_REORDER = /^\/api\/shows\/([^/]+)\/bars\/reorder$/
const SHOW_BAR          = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)$/
const SHOW_BAR_FIXTURE  = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)\/fixtures$/
const SHOW_BAR_FIX_ONE  = /^\/api\/shows\/([^/]+)\/bars\/([^/]+)\/fixtures\/([^/]+)$/

export async function barRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_BARS_RESTORE.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'bars-updated', () => {
        restoreBars(slug, body.bars ?? [])
      })
    }
  }

  if (m = SHOW_BARS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') return json(res, 200, readBars(slug))
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'bars-updated', () => writeBar(slug, body), {
        status: 201,
        responseBody: barId => ({ id: barId }),
      })
    }
  }

  if (m = SHOW_BARS_REORDER.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'bars-updated', () => {
        reorderBars(slug, body.order ?? [])
      })
    }
  }

  if (m = SHOW_BAR.exec(pathname)) {
    const slug = m[1]; const barId = m[2]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'bars-updated', () => {
        writeBar(slug, { ...body, id: barId })
      })
    }
    if (method === 'DELETE') {
      return withShowMutation(req, res, slug, 'bars-updated', (show) => {
        deleteBar(show.id, barId)
      })
    }
  }

  if (m = SHOW_BAR_FIXTURE.exec(pathname)) {
    const slug = m[1]; const barId = m[2]
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId, position, notes, fixtureId, side, positionText } = body
      if (!channelId) return json(res, 400, { error: 'channelId erforderlich' })
      return withShowMutation(req, res, slug, 'bars-updated', (show) => {
        return writeBarFixture(show.id, barId, channelId, { position, notes, fixtureId, side, positionText })
      }, {
        responseBody: id => ({ ok: true, id }),
      })
    }
  }

  if (m = SHOW_BAR_FIX_ONE.exec(pathname)) {
    const slug = m[1]; const barId = m[2]; const fixtureId = m[3]
    if (method === 'PATCH') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'bars-updated', (show) => {
        updateBarFixtureNotes(show.id, fixtureId, body.notes ?? '')
      })
    }
    if (method === 'DELETE') {
      return withShowMutation(req, res, slug, 'bars-updated', (show) => {
        removeBarFixture(show.id, fixtureId)
      })
    }
  }

  return null
}

import { deleteBar, readBars, removeBarFixture, reorderBars, restoreBars, updateBarFixtureNotes, writeBar, writeBarFixture } from '../db/bars.js'
import { readShow } from '../db/shows.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'
import { withUndoSnapshot } from '../db/operations.js'

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
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        restoreBars(slug, body.bars ?? [])
      })
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_BARS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') return json(res, 200, readBars(slug))
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      let barId
      withUndoSnapshot(slug, show.id, user.username, () => {
        barId = writeBar(slug, body)
      })
      broadcast(slug, 'bars-updated', {})
      return json(res, 201, { id: barId })
    }
  }

  if (m = SHOW_BARS_REORDER.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        reorderBars(slug, body.order ?? [])
      })
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_BAR.exec(pathname)) {
    const slug = m[1]; const barId = m[2]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        writeBar(slug, { ...body, id: barId })
      })
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        deleteBar(barId)
      })
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
      const show = readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      let id
      withUndoSnapshot(slug, show.id, user.username, () => {
        id = writeBarFixture(barId, channelId, { position, notes, fixtureId, side, positionText })
      })
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true, id })
    }
  }

  if (m = SHOW_BAR_FIX_ONE.exec(pathname)) {
    const slug = m[1]; const barId = m[2]; const fixtureId = m[3]
    if (method === 'PATCH') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        updateBarFixtureNotes(fixtureId, body.notes ?? '')
      })
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        removeBarFixture(fixtureId)
      })
      broadcast(slug, 'bars-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  return null
}

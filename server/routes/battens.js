import { deleteAllBattens, deleteBatten, readBattens, removeBattenFixture, reorderBattens, restoreBattens, updateBattenFixtureNotes, writeBatten, writeBattenFixture } from '../db/battens.js'
import { readJsonBody, json, withShowMutation } from '../helpers.js'

const SHOW_BATTENS         = /^\/api\/shows\/([^/]+)\/battens$/
const SHOW_BATTENS_RESTORE = /^\/api\/shows\/([^/]+)\/battens\/restore$/
const SHOW_BATTENS_REORDER = /^\/api\/shows\/([^/]+)\/battens\/reorder$/
const SHOW_BATTEN          = /^\/api\/shows\/([^/]+)\/battens\/([^/]+)$/
const SHOW_BATTEN_FIXTURE  = /^\/api\/shows\/([^/]+)\/battens\/([^/]+)\/fixtures$/
const SHOW_BATTEN_FIX_ONE  = /^\/api\/shows\/([^/]+)\/battens\/([^/]+)\/fixtures\/([^/]+)$/

export async function battenRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_BATTENS_RESTORE.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'battens-updated', () => {
        restoreBattens(slug, body.battens ?? [])
      })
    }
  }

  if (m = SHOW_BATTENS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') return json(res, 200, readBattens(slug))
    if (method === 'DELETE') {
      return withShowMutation(req, res, slug, 'battens-updated', (show) => {
        deleteAllBattens(show.id)
      })
    }
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'battens-updated', () => writeBatten(slug, body), {
        status: 201,
        responseBody: battenId => ({ id: battenId }),
      })
    }
  }

  if (m = SHOW_BATTENS_REORDER.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'battens-updated', () => {
        reorderBattens(slug, body.order ?? [])
      })
    }
  }

  if (m = SHOW_BATTEN.exec(pathname)) {
    const slug = m[1]; const battenId = m[2]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'battens-updated', () => {
        writeBatten(slug, { ...body, id: battenId })
      })
    }
    if (method === 'DELETE') {
      return withShowMutation(req, res, slug, 'battens-updated', (show) => {
        deleteBatten(show.id, battenId)
      })
    }
  }

  if (m = SHOW_BATTEN_FIXTURE.exec(pathname)) {
    const slug = m[1]; const battenId = m[2]
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId, position, notes, fixtureId, side, positionText, label } = body
      if (!channelId && !label) return json(res, 400, { error: 'channelId oder label erforderlich' })
      return withShowMutation(req, res, slug, 'battens-updated', (show) => {
        return writeBattenFixture(show.id, battenId, channelId ?? null, { position, notes, fixtureId, side, positionText, label })
      }, {
        responseBody: id => ({ ok: true, id }),
      })
    }
  }

  if (m = SHOW_BATTEN_FIX_ONE.exec(pathname)) {
    const slug = m[1]; const battenId = m[2]; const fixtureId = m[3]
    if (method === 'PATCH') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'battens-updated', (show) => {
        updateBattenFixtureNotes(show.id, fixtureId, body.notes ?? '')
      })
    }
    if (method === 'DELETE') {
      return withShowMutation(req, res, slug, 'battens-updated', (show) => {
        removeBattenFixture(show.id, fixtureId)
      })
    }
  }

  return null
}

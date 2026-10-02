import { readJsonBody, json, notFound } from '../helpers.js'
import { getTemplateByName } from '../db/templates.js'
import {
  readTemplateBattens, writeTemplateBatten, deleteTemplateBatten, reorderTemplateBattens,
  readTemplateBattenFixtures, writeTemplateBattenFixture, deleteTemplateBattenFixture,
} from '../db/template-battens.js'

const TPL_BATTENS             = /^\/api\/templates\/([^/]+)\/battens$/
const TPL_BATTENS_REORDER     = /^\/api\/templates\/([^/]+)\/battens\/reorder$/
const TPL_BATTEN              = /^\/api\/templates\/([^/]+)\/battens\/([^/]+)$/
const TPL_BATTEN_FIXTURES     = /^\/api\/templates\/([^/]+)\/battens\/([^/]+)\/fixtures$/
const TPL_BATTEN_FIXTURE      = /^\/api\/templates\/([^/]+)\/battens\/([^/]+)\/fixtures\/([^/]+)$/

export async function templateBattenRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = TPL_BATTENS_REORDER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = getTemplateByName(templateName)
    if (!tpl) return notFound(res)
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.order !== undefined && !Array.isArray(body.order)) return json(res, 400, { error: 'order muss ein Array sein' })
      reorderTemplateBattens(tpl.id, body.order ?? [])
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BATTEN.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const battenId = m[2]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      writeTemplateBatten(templateName, { ...body, id: battenId })
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      deleteTemplateBatten(templateName, battenId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BATTENS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, readTemplateBattens(templateName))
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const battenId = writeTemplateBatten(templateName, body)
      return json(res, 201, { id: battenId })
    }
  }

  // ── Batten-Fixtures ───────────────────────────────────────────────────────────
  if (m = TPL_BATTEN_FIXTURE.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const battenId = m[2]
    const fixtureId = m[3]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      writeTemplateBattenFixture(templateName, battenId, { ...body, id: fixtureId })
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      deleteTemplateBattenFixture(templateName, fixtureId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BATTEN_FIXTURES.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const battenId = m[2]
    if (method === 'GET') {
      return json(res, 200, readTemplateBattenFixtures(battenId))
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const fixtureId = writeTemplateBattenFixture(templateName, battenId, body)
      return json(res, 201, { id: fixtureId })
    }
  }

  return null
}

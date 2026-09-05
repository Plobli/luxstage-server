import { readJsonBody, json, notFound } from '../helpers.js'
import { getTemplateByName } from '../db/templates.js'
import {
  readTemplateBars, writeTemplateBar, deleteTemplateBar, reorderTemplateBars,
  readTemplateBarFixtures, writeTemplateBarFixture, deleteTemplateBarFixture,
} from '../db/template-bars.js'

const TPL_BARS             = /^\/api\/templates\/([^/]+)\/bars$/
const TPL_BARS_REORDER     = /^\/api\/templates\/([^/]+)\/bars\/reorder$/
const TPL_BAR              = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)$/
const TPL_BAR_FIXTURES     = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)\/fixtures$/
const TPL_BAR_FIXTURE      = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)\/fixtures\/([^/]+)$/

export async function templateBarRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = TPL_BARS_REORDER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = getTemplateByName(templateName)
    if (!tpl) return notFound(res)
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.order !== undefined && !Array.isArray(body.order)) return json(res, 400, { error: 'order muss ein Array sein' })
      reorderTemplateBars(tpl.id, body.order ?? [])
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BAR.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const barId = m[2]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      writeTemplateBar(templateName, { ...body, id: barId })
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      deleteTemplateBar(templateName, barId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BARS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, readTemplateBars(templateName))
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const barId = writeTemplateBar(templateName, body)
      return json(res, 201, { id: barId })
    }
  }

  // ── Bar-Fixtures ───────────────────────────────────────────────────────────
  if (m = TPL_BAR_FIXTURE.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const barId = m[2]
    const fixtureId = m[3]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      writeTemplateBarFixture(templateName, barId, { ...body, id: fixtureId })
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      deleteTemplateBarFixture(templateName, fixtureId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BAR_FIXTURES.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const barId = m[2]
    if (method === 'GET') {
      return json(res, 200, readTemplateBarFixtures(barId))
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const fixtureId = writeTemplateBarFixture(templateName, barId, body)
      return json(res, 201, { id: fixtureId })
    }
  }

  return null
}

import { readJsonBody, json } from '../helpers.js'
import { readTemplateSections, writeTemplateSections } from '../db/template-sections.js'

const TPL_SECTIONS = /^\/api\/templates\/([^/]+)\/sections$/

export async function templateSectionRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = TPL_SECTIONS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, readTemplateSections(templateName))
    }
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      if (!Array.isArray(body.sections)) return json(res, 400, { error: 'sections muss ein Array sein' })
      writeTemplateSections(templateName, body.sections)
      return json(res, 200, { ok: true })
    }
  }

  return null
}

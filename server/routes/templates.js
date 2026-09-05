import { randomUUID } from 'node:crypto'
import { readJsonBody, json, notFound, isRoute } from '../helpers.js'
import { generatePDF, pdfFilename } from '../pdf.js'
import { getDisplayUnit, getPhotosPerPage } from '../db/settings.js'
import {
  listTemplates, getTemplateByName, updateTemplateOscHost, renameTemplate,
  readTemplate, writeTemplate, deleteTemplate,
} from '../db/templates.js'
import { applyTemplateToAllShows } from '../db/template-apply-to-show.js'
import { readTemplateSections, writeTemplateSections, deleteTemplateSections } from '../db/template-sections.js'
import { acquireResourceLock, releaseResourceLock, touchResourceLock, getResourceLock } from '../db/resource-locks.js'
import { templateBarRoutes } from './template-bars.js'
import { templateTowerRoutes } from './template-towers.js'
import { templateSectionRoutes } from './template-sections.js'
import { templateFloorplanRoutes } from './template-floorplan.js'

const TPL_LIST     = /^\/api\/templates$/
const TPL_CHANNELS = /^\/api\/templates\/([^/]+)\/channels$/
const TPL_LOCK     = /^\/api\/templates\/([^/]+)\/lock$/
const TPL_APPLY    = /^\/api\/templates\/([^/]+)\/apply-to-shows$/
const TPL_PDF      = /^\/api\/templates\/([^/]+)\/pdf$/
const TPL_ID       = /^\/api\/templates\/(.+)$/

export async function templateRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (/\/bars(\/|$)/.test(pathname)) {
    const result = await templateBarRoutes(req, res, pathname)
    if (result !== null) return result
  }
  if (/\/towers(\/|$)/.test(pathname)) {
    const result = await templateTowerRoutes(req, res, pathname)
    if (result !== null) return result
  }
  if (/\/sections$/.test(pathname)) {
    const result = await templateSectionRoutes(req, res, pathname)
    if (result !== null) return result
  }
  if (/\/floorplan(\/|$)/.test(pathname)) {
    const result = await templateFloorplanRoutes(req, res, pathname)
    if (result !== null) return result
  }

  if (isRoute(method, pathname, 'GET', TPL_LIST)) {
    return json(res, 200, listTemplates())
  }

  if (isRoute(method, pathname, 'PUT', TPL_LIST)) {
    const user = req.user
    const body = await readJsonBody(req, res); if (body === null) return
    const { name, oscHost } = body
    if (!name || typeof name !== 'string') return json(res, 400, { error: 'Name fehlt' })
    const tpl = getTemplateByName(name)
    if (!tpl) return json(res, 404, { error: 'Bühnen-Template nicht gefunden' })
    const host = typeof oscHost === 'string' ? oscHost.trim() : ''
    if (host.length > 253) return json(res, 400, { error: 'OSC-Host zu lang' })
    updateTemplateOscHost(name, host)
    return json(res, 200, { ok: true })
  }

  // Template-Lock: gleicher Mechanismus wie beim Netzwerk (db/resource-locks.js
  // statt db/locks.js, da Templates keine eigene shows-Zeile haben). Kein
  // Takeover-Request/SSE-Broadcast wie bei Shows — der 423 aus router.js
  // verhindert aber bereits das stille gegenseitige Überschreiben.
  if (m = TPL_LOCK.exec(pathname)) {
    const lockKey = `template:${decodeURIComponent(m[1])}`
    const user = req.user
    if (method === 'GET') {
      return json(res, 200, { lock: getResourceLock(lockKey) })
    }
    if (method === 'POST') {
      const result = acquireResourceLock(lockKey, user.username)
      return json(res, result.ok ? 200 : 423, result)
    }
    if (method === 'PUT') {
      touchResourceLock(lockKey, user.username)
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      releaseResourceLock(lockKey, user.username)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_APPLY.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const validScopes = ['bars', 'towers', 'sections']
      const scope = validScopes.includes(body.scope) ? body.scope : 'bars'
      try {
        const stats = await applyTemplateToAllShows(templateName, scope)
        return json(res, 200, { ok: true, ...stats })
      } catch (e) {
        return json(res, 404, { error: e.message })
      }
    }
  }

  if (m = TPL_CHANNELS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      const channels = readTemplate(templateName).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
  }

  if (m = TPL_PDF.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = getTemplateByName(templateName)
    if (!tpl) return notFound(res)
    if (method === 'GET') {
      const channels = readTemplate(templateName).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      const show = { name: templateName, datum: null, template: null }
      const isBlankTemplate = true
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfFilename(show.name, isBlankTemplate)}"`,
        'Referrer-Policy': 'no-referrer',
      })
      await generatePDF({ show, channels }, res, { unit: getDisplayUnit(), photosPerPage: getPhotosPerPage(), blank: isBlankTemplate })
      return
    }
  }

  if (m = TPL_ID.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (!templateName || templateName.length > 100 || /[\x00-\x1F]/.test(templateName)) return json(res, 400, { error: 'Ungültiger Bühnen-Template-Name' })

    if (method === 'GET') {
      const channels = readTemplate(templateName).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
    if (method === 'PUT') {
      const user = req.user
      const channels = await readJsonBody(req, res); if (channels === null) return
      if (!Array.isArray(channels)) return json(res, 400, { error: 'channels muss ein Array sein' })
      writeTemplate(templateName, channels)
      const existing = readTemplateSections(templateName)
      if (!existing.length) {
        writeTemplateSections(templateName, [
          { id: randomUUID(), title: 'Aufbau', type: 'markdown', order: 0, fields: [] },
          { id: randomUUID(), title: 'Besonderheiten', type: 'markdown', order: 1, fields: [] },
        ])
      }
      return json(res, 200, { ok: true })
    }
    if (method === 'PATCH') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const newName = typeof body.name === 'string' ? body.name.trim() : ''
      if (!newName || newName.length > 100 || /[\x00-\x1F]/.test(newName)) return json(res, 400, { error: 'Ungültiger Bühnen-Template-Name' })
      const existing = getTemplateByName(newName)
      if (existing) return json(res, 409, { error: 'Name bereits vergeben' })
      renameTemplate(templateName, newName)
      return json(res, 200, { ok: true, name: newName })
    }
    if (method === 'DELETE') {
      const user = req.user
      deleteTemplate(templateName)
      deleteTemplateSections(templateName)
      return json(res, 200, { ok: true })
    }
  }

  return null
}

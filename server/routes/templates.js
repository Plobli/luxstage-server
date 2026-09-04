import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import * as floorplan from '../floorplan.js'
import * as photosLib from '../photos.js'
import { readJsonBody, json, notFound, uploadErrorStatus } from '../helpers.js'
import { generatePDF, pdfFilename } from '../pdf.js'
import { getDisplayUnit, getPhotosPerPage } from '../db/settings.js'
import {
  listTemplates, getTemplateByName, updateTemplateOscHost, renameTemplate,
  readTemplate, writeTemplate, deleteTemplate,
} from '../db/templates.js'
import { applyTemplateToAllShows } from '../db/template-apply.js'
import {
  readTemplateBars, writeTemplateBar, deleteTemplateBar, reorderTemplateBars,
  readTemplateBarFixtures, writeTemplateBarFixture, deleteTemplateBarFixture,
} from '../db/template-bars.js'
import {
  readTemplateTowers, writeTemplateTower, deleteTemplateTower, reorderTemplateTowers,
  writeTemplateTowerSlot, clearTemplateTowerSlot, ensureTemplateTowerSlots,
} from '../db/template-towers.js'
import { getTemplateFloorplan, upsertTemplateFloorplan, upsertTemplateFloorplanData } from '../db/floorplan.js'
import { readTemplateSections, writeTemplateSections, deleteTemplateSections } from '../db/template-sections.js'
import { acquireResourceLock, releaseResourceLock, touchResourceLock, getResourceLock } from '../db/resource-locks.js'

const TPL_LIST             = /^\/api\/templates$/
const TPL_CHANNELS         = /^\/api\/templates\/([^/]+)\/channels$/
const TPL_SECTIONS         = /^\/api\/templates\/([^/]+)\/sections$/
const TPL_BARS             = /^\/api\/templates\/([^/]+)\/bars$/
const TPL_BARS_REORDER     = /^\/api\/templates\/([^/]+)\/bars\/reorder$/
const TPL_BAR              = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)$/
const TPL_BAR_FIXTURES     = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)\/fixtures$/
const TPL_BAR_FIXTURE      = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)\/fixtures\/([^/]+)$/
const TPL_TOWERS           = /^\/api\/templates\/([^/]+)\/towers$/
const TPL_TOWERS_REORDER   = /^\/api\/templates\/([^/]+)\/towers\/reorder$/
const TPL_TOWER            = /^\/api\/templates\/([^/]+)\/towers\/([^/]+)$/
const TPL_TOWER_SLOT       = /^\/api\/templates\/([^/]+)\/towers\/([^/]+)\/slots\/([^/]+)$/
const TPL_LOCK             = /^\/api\/templates\/([^/]+)\/lock$/
const TPL_FP               = /^\/api\/templates\/([^/]+)\/floorplan$/
const TPL_FP_IMAGE         = /^\/api\/templates\/([^/]+)\/floorplan\/image$/
const TPL_APPLY            = /^\/api\/templates\/([^/]+)\/apply-to-shows$/
const TPL_PDF              = /^\/api\/templates\/([^/]+)\/pdf$/
const TPL_ID               = /^\/api\/templates\/(.+)$/

function mimeFromExt(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext]
    || 'application/octet-stream'
}

export async function templateRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (method === 'GET' && TPL_LIST.test(pathname)) {
    return json(res, 200, listTemplates())
  }

  if (method === 'PUT' && TPL_LIST.test(pathname)) {
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

  // ── Tower-Slot ─────────────────────────────────────────────────────────────
  if (m = TPL_TOWER_SLOT.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const towerId = m[2]
    const slotIndex = parseInt(m[3], 10)
    if (method === 'PATCH') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.channel === null && body.device === null && body.color === null) {
        clearTemplateTowerSlot(templateName, towerId, slotIndex)
      } else {
        writeTemplateTowerSlot(templateName, towerId, slotIndex, body)
      }
      return json(res, 200, { ok: true })
    }
  }

  // ── Tower ──────────────────────────────────────────────────────────────────
  if (m = TPL_TOWERS_REORDER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = getTemplateByName(templateName)
    if (!tpl) return notFound(res)
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.order !== undefined && !Array.isArray(body.order)) return json(res, 400, { error: 'order muss ein Array sein' })
      reorderTemplateTowers(tpl.id, body.order ?? [])
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_TOWER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const towerId = m[2]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      writeTemplateTower(templateName, { ...body, id: towerId })
      ensureTemplateTowerSlots(towerId, body.slot_count ?? 4)
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      deleteTemplateTower(templateName, towerId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_TOWERS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, readTemplateTowers(templateName))
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const towerId = writeTemplateTower(templateName, body)
      ensureTemplateTowerSlots(towerId, body.slot_count ?? 4)
      return json(res, 201, { id: towerId })
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

  if (m = TPL_FP_IMAGE.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = getTemplateByName(templateName)
    if (!tpl) return notFound(res)

    if (method === 'POST') {
      const ct = req.headers['content-type'] || ''
      if (!ct.startsWith('multipart/form-data')) return json(res, 400, { error: 'Ungültiger Upload' })
      let upload
      try {
        upload = await photosLib.parseMultipart(req)
        const file = upload.files[0]
        if (!file) return json(res, 400, { error: 'Kein Bild gefunden' })
        const mimeType = mimeFromExt(file.filename)
        const buffer = await fs.promises.readFile(file.path)
        const imgPath = await floorplan.saveFloorplanImage(tpl.id, file.filename, buffer, mimeType)
        upsertTemplateFloorplan(tpl.id, imgPath)
        return json(res, 200, { image_url: floorplan.floorplanUrl(imgPath) })
      } catch (e) {
        return json(res, uploadErrorStatus(e.message), { error: e.message || 'Bild-Upload fehlgeschlagen' })
      } finally {
        await upload?.cleanup()
      }
    }

    if (method === 'DELETE') {
      const fp = getTemplateFloorplan(tpl.id)
      if (fp?.image_path) await floorplan.deleteFloorplanImage(fp.image_path)
      upsertTemplateFloorplan(tpl.id, null)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_FP.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = getTemplateByName(templateName)
    if (!tpl) return notFound(res)

    if (method === 'GET') {
      const fp = getTemplateFloorplan(tpl.id)
      return json(res, 200, {
        image_url: fp?.image_path ? floorplan.floorplanUrl(fp.image_path) : null,
        canvas_data: fp?.canvas_data ?? null
      })
    }

    if (method === 'PUT') {
      const body = await readJsonBody(req, res)
      if (body === null) return
      // Gleicher Vertrag wie PUT /api/shows/:id/floorplan (routes/floorplan.js):
      // canvas_data muss ein bereits serialisierter String sein, statt hier
      // beliebige Payloads zu akzeptieren und stumm zu stringifyen (das konnte
      // z.B. für null den String "null" persistieren).
      const { canvas_data } = body
      if (typeof canvas_data !== 'string') return json(res, 400, { error: 'canvas_data fehlt' })
      upsertTemplateFloorplanData(tpl.id, canvas_data)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_CHANNELS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      const channels = readTemplate(templateName).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
  }

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

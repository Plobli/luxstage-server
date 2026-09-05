import fs from 'node:fs'
import * as floorplan from '../floorplan.js'
import * as photosLib from '../photos.js'
import { readJsonBody, json, notFound, uploadErrorStatus } from '../helpers.js'
import { getTemplateByName } from '../db/templates.js'
import { getTemplateFloorplan, upsertTemplateFloorplan, upsertTemplateFloorplanData } from '../db/floorplan.js'

const TPL_FP       = /^\/api\/templates\/([^/]+)\/floorplan$/
const TPL_FP_IMAGE = /^\/api\/templates\/([^/]+)\/floorplan\/image$/

function mimeFromExt(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext]
    || 'application/octet-stream'
}

export async function templateFloorplanRoutes(req, res, pathname) {
  const { method } = req
  let m

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

  return null
}

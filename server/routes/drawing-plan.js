import fs from 'node:fs'
import { getShowDrawingPlan, getTemplateDrawingPlan, upsertShowDrawingPlanData, upsertShowDrawingPlanImage } from '../db/drawing-plan.js'
import { readShow } from '../db/shows.js'
import { getTemplateByName } from '../db/templates.js'
import * as drawingPlanLib from '../drawing-plan.js'
import * as photosLib from '../photos.js'
import { readJsonBody, json, notFound, uploadErrorStatus } from '../helpers.js'
import { withUndoSnapshot } from '../db/operations.js'

const FP_IMAGES       = /^\/api\/drawing-plans\/images\/(.+)$/
const SHOW_FP         = /^\/api\/shows\/([^/]+)\/drawing-plan$/
const SHOW_FP_IMAGE   = /^\/api\/shows\/([^/]+)\/drawing-plan\/image$/

function mimeFromExt(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext]
    || 'application/octet-stream'
}

export async function drawingPlanRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = FP_IMAGES.exec(pathname)) {
    if (method === 'GET') {
      const served = await drawingPlanLib.serveDrawingPlanImage(m[1], res)
      if (!served) return notFound(res)
      return
    }
  }

  if (m = SHOW_FP_IMAGE.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = req.user
      const show = readShow(slug)
      if (!show) return notFound(res)
      const ct = req.headers['content-type'] || ''
      if (!ct.startsWith('multipart/form-data')) return json(res, 400, { error: 'Ungültiger Upload' })
      let upload
      try {
        upload = await photosLib.parseMultipart(req)
        const file = upload.files[0]
        if (!file) return json(res, 400, { error: 'Kein Bild gefunden' })
        const mimeType = mimeFromExt(file.filename)
        const buffer = await fs.promises.readFile(file.path)
        const imgPath = await drawingPlanLib.saveDrawingPlanImage(show.id, file.filename, buffer, mimeType)
        withUndoSnapshot(slug, show.id, user.username, () => {
          upsertShowDrawingPlanImage(show.id, imgPath)
        })
        return json(res, 200, { image_url: drawingPlanLib.drawingPlanUrl(imgPath) })
      } catch (e) {
        return json(res, uploadErrorStatus(e.message), { error: e.message || 'Bild-Upload fehlgeschlagen' })
      } finally {
        await upload?.cleanup()
      }
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = readShow(slug)
      if (!show) return notFound(res)
      const layer = getShowDrawingPlan(show.id)
      if (layer?.image_path) await drawingPlanLib.deleteDrawingPlanImage(layer.image_path)
      withUndoSnapshot(slug, show.id, user.username, () => {
        upsertShowDrawingPlanImage(show.id, null)
      })
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_FP.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const show = readShow(slug)
      if (!show) return notFound(res)
      const layer = getShowDrawingPlan(show.id)
      let imageUrl = null
      let canvasData = layer?.canvas_data ?? null
      if (layer?.image_path) {
        imageUrl = drawingPlanLib.drawingPlanUrl(layer.image_path)
      } else if (show.template) {
        const tpl = getTemplateByName(show.template)
        if (tpl) {
          const fp = getTemplateDrawingPlan(tpl.id)
          if (fp?.image_path) imageUrl = drawingPlanLib.drawingPlanUrl(fp.image_path)
          if (!canvasData && fp?.canvas_data) canvasData = fp.canvas_data
        }
      }
      return json(res, 200, { image_url: imageUrl, canvas_data: canvasData })
    }
    if (method === 'PUT') {
      const user = req.user
      const show = readShow(slug)
      if (!show) return notFound(res)
      const body = await readJsonBody(req, res); if (body === null) return
      const { canvas_data } = body
      if (typeof canvas_data !== 'string') return json(res, 400, { error: 'canvas_data fehlt' })
      withUndoSnapshot(slug, show.id, user.username, () => {
        upsertShowDrawingPlanData(show.id, canvas_data)
      })
      return json(res, 200, { ok: true })
    }
  }

  return null
}

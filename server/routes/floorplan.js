import fs from 'node:fs'
import { getShowFloorplan, getTemplateFloorplan, upsertShowFloorplanData, upsertShowFloorplanImage } from '../db/floorplan.js'
import { readShow } from '../db/shows.js'
import { getTemplateByName } from '../db/templates.js'
import * as floorplanLib from '../floorplan.js'
import * as photosLib from '../photos.js'
import { readJsonBody, json, notFound } from '../helpers.js'
import { withUndoSnapshot } from '../db/operations.js'

const FP_IMAGES       = /^\/api\/floorplans\/images\/(.+)$/
const SHOW_FP         = /^\/api\/shows\/([^/]+)\/floorplan$/
const SHOW_FP_IMAGE   = /^\/api\/shows\/([^/]+)\/floorplan\/image$/

function mimeFromExt(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext]
    || 'application/octet-stream'
}

export async function floorplanRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = FP_IMAGES.exec(pathname)) {
    if (method === 'GET') {
      const served = await floorplanLib.serveFloorplanImage(m[1], res)
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
        const imgPath = await floorplanLib.saveFloorplanImage(show.id, file.filename, buffer, mimeType)
        withUndoSnapshot(slug, show.id, user.username, () => {
          upsertShowFloorplanImage(show.id, imgPath)
        })
        return json(res, 200, { image_url: floorplanLib.floorplanUrl(imgPath) })
      } catch (e) {
        const status = /zu groß|zu viele/i.test(e.message) ? 413 : 400
        return json(res, status, { error: e.message || 'Bild-Upload fehlgeschlagen' })
      } finally {
        await upload?.cleanup()
      }
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = readShow(slug)
      if (!show) return notFound(res)
      const layer = getShowFloorplan(show.id)
      if (layer?.image_path) await floorplanLib.deleteFloorplanImage(layer.image_path)
      withUndoSnapshot(slug, show.id, user.username, () => {
        upsertShowFloorplanImage(show.id, null)
      })
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_FP.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const show = readShow(slug)
      if (!show) return notFound(res)
      const layer = getShowFloorplan(show.id)
      let imageUrl = null
      let canvasData = layer?.canvas_data ?? null
      if (layer?.image_path) {
        imageUrl = floorplanLib.floorplanUrl(layer.image_path)
      } else if (show.template) {
        const tpl = getTemplateByName(show.template)
        if (tpl) {
          const fp = getTemplateFloorplan(tpl.id)
          if (fp?.image_path) imageUrl = floorplanLib.floorplanUrl(fp.image_path)
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
        upsertShowFloorplanData(show.id, canvas_data)
      })
      return json(res, 200, { ok: true })
    }
  }

  return null
}

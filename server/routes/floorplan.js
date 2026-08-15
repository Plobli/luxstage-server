import fs from 'node:fs'
import * as db from '../db.js'
import * as floorplanLib from '../floorplan.js'
import * as photosLib from '../photos.js'
import { readJsonBody, json, notFound } from '../helpers.js'

const FP_IMAGES       = /^\/api\/floorplans\/images\/(.+)$/
const SHOW_FP         = /^\/api\/shows\/([^/]+)\/floorplan$/
const SHOW_FP_IMAGE   = /^\/api\/shows\/([^/]+)\/floorplan\/image$/
const SHOW_FP_SNAP    = /^\/api\/shows\/([^/]+)\/floorplan\/snapshot$/

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

  if (m = SHOW_FP_SNAP.exec(pathname)) {
    const showId = m[1]
    if (method === 'GET') {
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      const snapshotPath = floorplanLib.getFloorplanSnapshotPath(show.id)
      try {
        const buf = await fs.promises.readFile(snapshotPath)
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': buf.length, 'Cache-Control': 'no-cache' })
        res.end(buf)
      } catch { return notFound(res) }
      return
    }
    if (method === 'PUT') {
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      const body = await readJsonBody(req, res); if (body === null) return
      const { data_url } = body
      if (typeof data_url !== 'string' || !data_url.startsWith('data:image/')) {
        return json(res, 400, { error: 'data_url fehlt oder ungültig' })
      }
      const overflow = typeof body.overflow === 'number' ? body.overflow : 0
      const base64 = data_url.replace(/^data:image\/\w+;base64,/, '')
      await floorplanLib.saveFloorplanSnapshot(show.id, Buffer.from(base64, 'base64'), overflow)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_FP_IMAGE.exec(pathname)) {
    const showId = m[1]
    if (method === 'POST') {
      const show = db.readShow(showId)
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
        db.upsertShowFloorplanImage(show.id, imgPath)
        return json(res, 200, { image_url: floorplanLib.floorplanUrl(imgPath) })
      } catch (e) {
        const status = /zu groß|zu viele/i.test(e.message) ? 413 : 400
        return json(res, status, { error: e.message || 'Bild-Upload fehlgeschlagen' })
      } finally {
        await upload?.cleanup()
      }
    }
    if (method === 'DELETE') {
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      const layer = db.getShowFloorplan(show.id)
      if (layer?.image_path) await floorplanLib.deleteFloorplanImage(layer.image_path)
      db.upsertShowFloorplanImage(show.id, null)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_FP.exec(pathname)) {
    const showId = m[1]
    if (method === 'GET') {
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      const layer = db.getShowFloorplan(show.id)
      let imageUrl = null
      let canvasData = layer?.canvas_data ?? null
      if (layer?.image_path) {
        imageUrl = floorplanLib.floorplanUrl(layer.image_path)
      } else if (show.template) {
        const tpl = db.getTemplateByName(show.template)
        if (tpl) {
          const fp = db.getTemplateFloorplan(tpl.id)
          if (fp?.image_path) imageUrl = floorplanLib.floorplanUrl(fp.image_path)
          if (!canvasData && fp?.canvas_data) canvasData = fp.canvas_data
        }
      }
      return json(res, 200, { image_url: imageUrl, canvas_data: canvasData })
    }
    if (method === 'PUT') {
      const show = db.readShow(showId)
      if (!show) return notFound(res)
      const body = await readJsonBody(req, res); if (body === null) return
      const { canvas_data } = body
      if (typeof canvas_data !== 'string') return json(res, 400, { error: 'canvas_data fehlt' })
      db.upsertShowFloorplanData(show.id, canvas_data)
      return json(res, 200, { ok: true })
    }
  }

  return null
}

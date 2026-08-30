import fs from 'node:fs'
import * as db from '../db.js'
import * as photosLib from '../photos.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'
import { recordOperation, clearRedo } from '../db/operations.js'
import { requireAuth } from '../auth.js'
import { analyzeCircuitScan } from '../circuit-scan.js'

const SHOW_CHANNELS     = /^\/api\/shows\/([^/]+)\/channels$/
const SHOW_CHECKS       = /^\/api\/shows\/([^/]+)\/checks$/
const SHOW_CIRCUIT_SCAN = /^\/api\/shows\/([^/]+)\/circuit-scan$/
const COLOR_USAGE       = /^\/api\/channels\/color-usage$/

export async function channelStatsRoutes(req, res, pathname) {
  if (req.method === 'GET' && COLOR_USAGE.test(pathname)) {
    return json(res, 200, db.getColorUsage())
  }
  return null
}

export async function channelRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_CHANNELS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const channels = db.readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
    if (method === 'PUT') {
      const user = req.user
      const channels = await readJsonBody(req, res); if (channels === null) return

      const show = db.readShow(slug)
      const oldChannels = db.readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
      db.writeChannels(slug, channels, user.username)
      if (show) {
        recordOperation(show.id, user.username, 'channels', oldChannels, channels)
        clearRedo(show.id)
      }
      broadcast(slug, 'channels-updated', { updatedBy: user.username })
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_CIRCUIT_SCAN.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const ct = req.headers['content-type'] || ''
      if (!ct.startsWith('multipart/form-data')) return json(res, 400, { error: 'Ungültiger Upload' })
      let upload
      try {
        upload = await photosLib.parseMultipart(req)
        const file = upload.files[0]
        if (!file) return json(res, 400, { error: 'Kein Bild gefunden' })
        const imageBuffer = await fs.promises.readFile(file.path)
        const knownChannels = db.readChannels(slug).map(({ channel, address, device, position }) => ({ channel, address, device, position }))
        const result = await analyzeCircuitScan(imageBuffer, knownChannels)
        return json(res, 200, result)
      } catch (error) {
        const status = /zu groß|zu viele/i.test(error.message) ? 413 : 400
        return json(res, status, { error: error.message || 'Kreisliste konnte nicht ausgewertet werden' })
      } finally {
        await upload?.cleanup()
      }
    }
  }

  if (m = SHOW_CHECKS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      return json(res, 200, { checks: db.getChecks(slug) })
    }
    if (method === 'DELETE') {
      db.clearChecks(slug)
      broadcast(slug, 'checks-updated', { checks: [] })
      return json(res, 200, { ok: true })
    }
    if (method === 'PATCH') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId, checked } = body
      if (!channelId || typeof checked !== 'boolean') return json(res, 400, { error: 'channelId und checked erforderlich' })
      db.setCheck(slug, channelId, checked, user.username)
      broadcast(slug, 'checks-updated', { checks: db.getChecks(slug) })
      return json(res, 200, { ok: true })
    }
  }

  return null
}

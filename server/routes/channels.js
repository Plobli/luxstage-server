import * as db from '../db.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'

const SHOW_CHANNELS = /^\/api\/shows\/([^/]+)\/channels$/
const SHOW_CHECKS   = /^\/api\/shows\/([^/]+)\/checks$/

export async function channelRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_CHANNELS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const channels = db.readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
      const version = db.getChannelsVersion(slug)
      return json(res, 200, channels, version !== null ? { 'X-Show-Version': version } : {})
    }
    if (method === 'PUT') {
      const user = req.user
      const channels = await readJsonBody(req, res); if (channels === null) return

      // Konflikterkennung: der Client schickt die Version, auf der seine
      // Änderung basiert. channels_version zählt ausschließlich bei
      // Channel-Writes hoch (anders als updated_at, das auch Meta-Updates,
      // Archivieren etc. mit verändern und daher jedes Speichern fälschlich
      // wie einen Konflikt aussehen lassen würden). Weicht die Version ab,
      // hat zwischen Laden und Speichern jemand anders gespeichert — statt
      // still zu überschreiben meldet der Server 409 und der Client
      // entscheidet (neu laden oder erzwingen).
      const baseVersion = req.headers['if-match']
      if (baseVersion) {
        const currentVersion = db.getChannelsVersion(slug)
        if (currentVersion !== null && currentVersion !== baseVersion) {
          const serverChannels = db.readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
          return json(res, 409, { error: 'conflict', serverVersion: currentVersion, serverChannels })
        }
      }

      db.writeChannels(slug, channels, user.username)
      broadcast(slug, 'channels-updated', { updatedBy: user.username })
      const version = db.getChannelsVersion(slug)
      return json(res, 200, { ok: true }, version !== null ? { 'X-Show-Version': version } : {})
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

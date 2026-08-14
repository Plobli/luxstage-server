import * as db from '../db.js'
import { requireAdmin } from '../auth.js'
import { readJsonBody, json, notFound } from '../helpers.js'
import { subscribe, broadcast, getPresence } from '../sse.js'

const SHOW_LIST          = /^\/api\/shows$/
const SHOW_ARCHIVED      = /^\/api\/shows\/archived$/
const SHOW_ID            = /^\/api\/shows\/([^/]+)$/
const SHOW_META          = /^\/api\/shows\/([^/]+)\/meta$/
const SHOW_RESTORE       = /^\/api\/shows\/([^/]+)\/restore$/
const SHOW_PERM          = /^\/api\/shows\/([^/]+)\/permanent$/
const SHOW_LOCK          = /^\/api\/shows\/([^/]+)\/lock$/
const SHOW_EVENTS        = /^\/api\/shows\/([^/]+)\/events$/
const SHOW_PRESENCE      = /^\/api\/shows\/([^/]+)\/presence$/
const SHOW_FROM_TEMPLATE = /^\/api\/shows\/([^/]+)\/from-template$/
const SHOW_TO_TEMPLATE   = /^\/api\/shows\/([^/]+)\/to-template$/

export async function showRoutes(req, res, pathname, params) {
  const { method } = req
  let m

  if (method === 'GET' && SHOW_LIST.test(pathname)) {
    const shows = db.listShows()
    return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s })))
  }

  if (method === 'GET' && SHOW_ARCHIVED.test(pathname)) {
    const shows = db.listArchivedShows()
    return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s })))
  }

  if (method === 'POST' && SHOW_LIST.test(pathname)) {
    const body = await readJsonBody(req, res); if (body === null) return
    const { id, name, datum, template, spielzeit, channels, use_bars, use_towers } = body
    if (!id || !/^[a-z0-9_-]+$/i.test(id)) return json(res, 400, { error: 'Ungültige ID' })
    db.createShow(id, { name, datum, template, spielzeit, use_bars: use_bars !== false, use_towers: use_towers !== false })
    if (Array.isArray(channels) && channels.length) db.writeChannels(id, channels)
    return json(res, 201, { id })
  }

  if (m = SHOW_META.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const { setupMarkdown, eosActiveChannels, eosExcludedChannels, use_bars, use_towers, ...rest } = body
      const fields = { ...rest }
      if (setupMarkdown !== undefined) fields.setup_markdown = setupMarkdown
      if (eosActiveChannels !== undefined) fields.eos_active_channels = JSON.stringify(eosActiveChannels)
      if (eosExcludedChannels !== undefined) fields.eos_excluded_channels = JSON.stringify(eosExcludedChannels)
      if (use_bars !== undefined) fields.use_bars = use_bars ? 1 : 0
      if (use_towers !== undefined) fields.use_towers = use_towers ? 1 : 0
      fields.last_edited_by = user.username
      fields.last_edited_at = Date.now()
      db.writeShow(slug, fields)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_FROM_TEMPLATE.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const body = await readJsonBody(req, res); if (body === null) return
      const validScopes = ['bars', 'towers']
      const scope = validScopes.includes(body.scope) ? body.scope : 'bars'
      const withChannels = body.withChannels === true
      const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds : null
      try {
        db.applyTemplateToShow(body.templateName, slug, scope, withChannels, selectedIds)
        broadcast(slug, scope === 'bars' ? 'bars' : 'towers', {})
        return json(res, 200, { ok: true })
      } catch (e) {
        return json(res, 404, { error: e.message })
      }
    }
  }

  if (m = SHOW_TO_TEMPLATE.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = requireAdmin(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const validScopes = ['bars', 'towers']
      const scope = validScopes.includes(body.scope) ? body.scope : 'bars'
      const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds : []
      const fields = body.fields && typeof body.fields === 'object' ? body.fields : {}
      const overrideName = typeof body.overrideName === 'string' ? body.overrideName.trim() : null
      const show = db.readShow(slug)
      if (!show) return notFound(res)
      const templateName = body.templateName ?? show.template
      if (!templateName) return json(res, 400, { error: 'Kein Template zugeordnet' })
      try {
        db.saveShowItemsToTemplate(templateName, slug, scope, selectedIds, fields, overrideName)
        return json(res, 200, { ok: true })
      } catch (e) {
        return json(res, 404, { error: e.message })
      }
    }
  }

  if (m = SHOW_RESTORE.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      db.restoreShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_PERM.exec(pathname)) {
    const slug = m[1]
    if (method === 'DELETE') {
      const user = requireAdmin(req, res); if (!user) return
      db.deleteShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_LOCK.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = req.user
      const result = db.acquireLock(slug, user.username)
      return json(res, result.ok ? 200 : 423, result)
    }
    if (method === 'DELETE') {
      const user = req.user
      db.releaseLock(slug, user.username)
      return json(res, 200, { ok: true })
    }
    if (method === 'PUT') {
      const user = req.user
      db.touchLock(slug, user.username)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_EVENTS.exec(pathname)) {
    if (method === 'GET') {
      const user = req.user
      const id = m[1]
      const device = params.device || 'web'
      subscribe(id, res, user.username, device, db.getChecks)
      return
    }
  }

  if (m = SHOW_PRESENCE.exec(pathname)) {
    if (method === 'GET') {
      return json(res, 200, { users: getPresence(m[1]) })
    }
  }

  if (m = SHOW_ID.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const show = db.readShow(slug)
      if (!show) return notFound(res)
      const channels = db.readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
      const lock = db.getLock(slug)
      return json(res, 200, {
        id: show.slug,
        name: show.name,
        datum: show.datum,
        template: show.template,
        spielzeit: show.spielzeit,
        use_bars: show.use_bars !== 0,
        use_towers: show.use_towers !== 0,
        setupMarkdown: show.setup_markdown ?? '',
        eosActiveChannels: show.eos_active_channels ? JSON.parse(show.eos_active_channels) : null,
        eosExcludedChannels: show.eos_excluded_channels ? JSON.parse(show.eos_excluded_channels) : null,
        channels,
        lock,
      })
    }
    if (method === 'DELETE') {
      db.archiveShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  return null
}

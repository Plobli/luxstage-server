import * as db from '../db.js'
import { requireAdmin } from '../auth.js'
import { readJsonBody, json, notFound } from '../helpers.js'
import { subscribe, broadcast, sendToUser, getPresence } from '../sse.js'
import { getLastOperation, deleteOperation, pushRedo, popRedo, recordOperation } from '../db/operations.js'
import { restoreTowers } from '../db/towers.js'
import { restoreBars } from '../db/bars.js'

const SHOW_LIST          = /^\/api\/shows$/
const SHOW_ARCHIVED      = /^\/api\/shows\/archived$/
const SHOW_ID            = /^\/api\/shows\/([^/]+)$/
const SHOW_META          = /^\/api\/shows\/([^/]+)\/meta$/
const SHOW_RESTORE       = /^\/api\/shows\/([^/]+)\/restore$/
const SHOW_PERM          = /^\/api\/shows\/([^/]+)\/permanent$/
const SHOW_LOCK          = /^\/api\/shows\/([^/]+)\/lock$/
const SHOW_LOCK_TAKEOVER = /^\/api\/shows\/([^/]+)\/lock\/request-takeover$/
const SHOW_EVENTS        = /^\/api\/shows\/([^/]+)\/events$/
const SHOW_PRESENCE      = /^\/api\/shows\/([^/]+)\/presence$/
const SHOW_FROM_TEMPLATE = /^\/api\/shows\/([^/]+)\/from-template$/
const SHOW_TO_TEMPLATE   = /^\/api\/shows\/([^/]+)\/to-template$/
const SHOW_UNDO          = /^\/api\/shows\/([^/]+)\/undo$/
const SHOW_REDO          = /^\/api\/shows\/([^/]+)\/redo$/

// Wendet alt/neu-Payload einer Operation an — dieselbe DB-Schreibfunktion wie
// der jeweilige Route-Handler, aber ohne recordOperation() erneut aufzurufen
// (sonst würde Undo selbst eine neue Operation erzeugen und den Stack verfälschen).
function applyOperationValue(slug, resourceType, username, value) {
  switch (resourceType) {
    case 'channels':
      db.writeChannels(slug, value, username)
      broadcast(slug, 'channels-updated', { updatedBy: username })
      break
    case 'sections': {
      const map = new Map(value.map(s => [s.id, s.content]))
      db.writeShowSections(slug, map, username)
      broadcast(slug, 'sections-updated', { updatedBy: username })
      break
    }
    case 'section-defs':
      db.writeShowSectionDefs(slug, value, username)
      broadcast(slug, 'sections-updated', { updatedBy: username })
      break
    case 'towers':
      restoreTowers(slug, value)
      broadcast(slug, 'towers-updated', {})
      break
    case 'bars':
      restoreBars(slug, value)
      broadcast(slug, 'bars-updated', {})
      break
    default:
      throw new Error(`Unbekannter resource_type: ${resourceType}`)
  }
}

export async function showRoutes(req, res, pathname, params) {
  const { method } = req
  let m

  if (method === 'GET' && SHOW_LIST.test(pathname)) {
    const shows = db.listShows()
    const locks = db.listLocks()
    return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s, lock: locks.get(_id) ?? null })))
  }

  if (method === 'GET' && SHOW_ARCHIVED.test(pathname)) {
    const shows = db.listArchivedShows()
    return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s })))
  }

  if (method === 'POST' && SHOW_LIST.test(pathname)) {
    const body = await readJsonBody(req, res); if (body === null) return
    const { id, name, datum, template, spielzeit, channels, use_bars, use_towers, importSections } = body
    if (!id || !/^[a-z0-9_-]+$/i.test(id)) return json(res, 400, { error: 'Ungültige ID' })
    db.createShow(id, { name, datum, template, spielzeit, use_bars: use_bars !== false, use_towers: use_towers !== false, importSections })
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
      const validScopes = ['bars', 'towers', 'sections']
      const scope = validScopes.includes(body.scope) ? body.scope : 'bars'
      const withChannels = body.withChannels === true
      const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds : null
      try {
        db.applyTemplateToShow(body.templateName, slug, scope, withChannels, selectedIds)
        if (scope !== 'sections') broadcast(slug, scope === 'bars' ? 'bars' : 'towers', {})
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

  if (m = SHOW_UNDO.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      // Lock bereits zentral in router.js geprüft (undo ist ein normaler Write).
      const user = req.user
      const show = db.readShow(slug)
      if (!show) return notFound(res)

      const op = getLastOperation(show.id)
      if (!op) return json(res, 400, { error: 'Nichts zum Rückgängigmachen' })

      const { old: oldValue, new: newValue } = JSON.parse(op.payload)
      applyOperationValue(slug, op.resource_type, user.username, oldValue)
      deleteOperation(op.id)
      pushRedo(show.id, { resource_type: op.resource_type, old: oldValue, new: newValue })
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_REDO.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      // Lock bereits zentral in router.js geprüft (redo ist ein normaler Write).
      const user = req.user
      const show = db.readShow(slug)
      if (!show) return notFound(res)

      const entry = popRedo(show.id)
      if (!entry) return json(res, 400, { error: 'Nichts zum Wiederholen' })

      applyOperationValue(slug, entry.resource_type, user.username, entry.new)
      recordOperation(show.id, user.username, entry.resource_type, entry.old, entry.new)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_LOCK_TAKEOVER.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = req.user
      const lock = db.getLock(slug)
      if (!lock) return json(res, 400, { error: 'Keine Sperre aktiv' })
      if (lock.user === user.username) return json(res, 400, { error: 'Du hältst bereits die Sperre' })
      sendToUser(slug, lock.user, 'lock-takeover-requested', { requestedBy: user.username })
      return json(res, 200, { ok: true, notified: lock.user })
    }
  }

  if (m = SHOW_LOCK.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = req.user
      const result = db.acquireLock(slug, user.username)
      if (result.ok) broadcast(slug, 'lock-status-updated', { lock: db.getLock(slug) })
      return json(res, result.ok ? 200 : 423, result)
    }
    if (method === 'DELETE') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.transferTo) {
        db.transferLock(slug, user.username, body.transferTo)
      } else {
        db.releaseLock(slug, user.username)
      }
      broadcast(slug, 'lock-status-updated', { lock: db.getLock(slug) })
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

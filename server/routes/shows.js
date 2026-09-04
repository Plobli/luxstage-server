import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { subscribe, broadcast, sendToUser, getPresence } from '../sse.js'
import { handleUndoRedo } from './undo-redo.js'
import { getLastOperation, deleteOperation, pushRedo, popRedo, recordSnapshot } from '../db/operations.js'
import { readFullShowState, writeFullShowState, computeStateHash } from '../db/full-state.js'
import { acquireLock, releaseLock, transferLock, touchLock, getLock, listLocks } from '../db/locks.js'
import { applyTemplateToShow, saveShowItemsToTemplate } from '../db/template-apply.js'
import { readChannels, writeChannels, getChecks } from '../db/channels.js'
import { listShows, listArchivedShows, requireShow, writeShow, createShow, archiveShow, restoreShow, deleteShow } from '../db/shows.js'

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

// Nach Undo/Redo sind alle Bereiche potenziell betroffen (der Snapshot deckt
// den gesamten Show-Zustand ab) — jeder Client aktualisiert also alle vier.
function broadcastShowState(slug, updatedBy) {
  broadcast(slug, 'channels-updated', { updatedBy })
  broadcast(slug, 'sections-updated', { updatedBy })
  broadcast(slug, 'towers-updated', {})
  broadcast(slug, 'bars-updated', {})
  broadcast(slug, 'floorplan-updated', {})
}

export async function showRoutes(req, res, pathname, params) {
  const { method } = req
  let m

  if (method === 'GET' && SHOW_LIST.test(pathname)) {
    const shows = listShows()
    const locks = listLocks()
    return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s, lock: locks.get(_id) ?? null })))
  }

  if (method === 'GET' && SHOW_ARCHIVED.test(pathname)) {
    const shows = listArchivedShows()
    return json(res, 200, shows.map(({ id: _id, ...s }) => ({ id: s.slug, ...s })))
  }

  if (method === 'POST' && SHOW_LIST.test(pathname)) {
    const body = await readJsonBody(req, res); if (body === null) return
    const { id, name, datum, template, spielzeit, channels, use_bars, use_towers, importSections } = body
    if (!id || !/^[a-z0-9_-]+$/i.test(id)) return json(res, 400, { error: 'Ungültige ID' })
    try {
      createShow(id, { name, datum, template, spielzeit, use_bars: use_bars !== false, use_towers: use_towers !== false, importSections })
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return json(res, 409, { error: 'Eine Show mit dieser ID existiert bereits' })
      throw err
    }
    if (Array.isArray(channels) && channels.length) writeChannels(id, channels)
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
      writeShow(slug, fields)
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
        applyTemplateToShow(body.templateName, slug, scope, withChannels, selectedIds)
        if (scope !== 'sections') broadcast(slug, scope === 'bars' ? 'bars-updated' : 'towers-updated', {})
        return json(res, 200, { ok: true })
      } catch (e) {
        return json(res, 404, { error: e.message })
      }
    }
  }

  if (m = SHOW_TO_TEMPLATE.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const validScopes = ['bars', 'towers']
      const scope = validScopes.includes(body.scope) ? body.scope : 'bars'
      const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds : []
      const fields = body.fields && typeof body.fields === 'object' ? body.fields : {}
      const overrideName = typeof body.overrideName === 'string' ? body.overrideName.trim() : null
      const show = requireShow(slug, res)
      if (!show) return
      const templateName = body.templateName ?? show.template
      if (!templateName) return json(res, 400, { error: 'Kein Template zugeordnet' })
      try {
        saveShowItemsToTemplate(templateName, slug, scope, selectedIds, fields, overrideName)
        return json(res, 200, { ok: true })
      } catch (e) {
        return json(res, 404, { error: e.message })
      }
    }
  }

  if (m = SHOW_RESTORE.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      restoreShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_PERM.exec(pathname)) {
    const slug = m[1]
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      deleteShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_UNDO.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      // Lock bereits zentral in router.js geprüft (undo ist ein normaler Write).
      const user = req.user
      const show = requireShow(slug, res)
      if (!show) return

      return handleUndoRedo(res, 'undo', {
        getEntry: () => getLastOperation(show.id),
        computeHash: computeStateHash,
        readState: () => readFullShowState(slug),
        writeState: (state) => writeFullShowState(slug, state, user.username),
        consumeEntry: (op) => deleteOperation(op.id),
        pushOpposite: (currentState) => pushRedo(show.id, currentState),
        broadcast: () => broadcastShowState(slug, user.username),
      })
    }
  }

  if (m = SHOW_REDO.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      // Lock bereits zentral in router.js geprüft (redo ist ein normaler Write).
      const user = req.user
      const show = requireShow(slug, res)
      if (!show) return

      return handleUndoRedo(res, 'redo', {
        getEntry: () => popRedo(show.id),
        computeHash: computeStateHash,
        readState: () => readFullShowState(slug),
        writeState: (state) => writeFullShowState(slug, state, user.username),
        consumeEntry: () => {}, // popRedo() hat den Eintrag beim Holen bereits entfernt
        pushOpposite: (currentState) => recordSnapshot(show.id, user.username, currentState),
        broadcast: () => broadcastShowState(slug, user.username),
      })
    }
  }

  if (m = SHOW_LOCK_TAKEOVER.exec(pathname)) {
    const slug = m[1]
    if (method === 'POST') {
      const user = req.user
      const lock = getLock(slug)
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
      const result = acquireLock(slug, user.username)
      if (result.ok) broadcast(slug, 'lock-status-updated', { lock: getLock(slug) })
      return json(res, result.ok ? 200 : 423, result)
    }
    if (method === 'DELETE') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.transferTo) {
        transferLock(slug, user.username, body.transferTo)
      } else {
        releaseLock(slug, user.username)
      }
      broadcast(slug, 'lock-status-updated', { lock: getLock(slug) })
      return json(res, 200, { ok: true })
    }
    if (method === 'PUT') {
      const user = req.user
      touchLock(slug, user.username)
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_EVENTS.exec(pathname)) {
    if (method === 'GET') {
      const user = req.user
      const id = m[1]
      const device = params.device || 'web'
      subscribe(id, res, user.username, device, getChecks)
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
      const show = requireShow(slug, res)
      if (!show) return
      const channels = readChannels(slug).map(({ show_id: _, sort_order: __, ...ch }) => ch)
      const lock = getLock(slug)
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
      archiveShow(slug)
      return json(res, 200, { ok: true })
    }
  }

  return null
}

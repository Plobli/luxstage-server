import { getLock } from '../db/locks.js'
import { json, notFound } from '../helpers.js'
import { listHistory, getHistoryEntry, restoreHistoryEntry, takeSnapshotNow } from '../history.js'

const HISTORY_SNAP    = /^\/api\/shows\/([^/]+)\/history\/snapshot$/
const HISTORY_LIST    = /^\/api\/shows\/([^/]+)\/history$/
const HISTORY_RESTORE = /^\/api\/shows\/([^/]+)\/history\/([^/]+)\/restore$/
const HISTORY_ENTRY   = /^\/api\/shows\/([^/]+)\/history\/([^/]+)$/

export async function historyRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = HISTORY_SNAP.exec(pathname)) {
    if (method === 'POST') {
      const user = req.user
      takeSnapshotNow(m[1])
      return json(res, 200, { ok: true })
    }
  }

  if (m = HISTORY_RESTORE.exec(pathname)) {
    if (method === 'POST') {
      const user = req.user
      const [, slug, historyId] = m
      const lock = getLock(slug)
      if (lock && lock.user !== user.username) return json(res, 423, { lockedBy: lock.user })
      const ok = restoreHistoryEntry(slug, historyId)
      if (!ok) return notFound(res)
      return json(res, 200, { ok: true })
    }
  }

  if (m = HISTORY_ENTRY.exec(pathname)) {
    if (method === 'GET') {
      const [, slug, historyId] = m
      const entry = getHistoryEntry(slug, historyId)
      if (!entry) return notFound(res)
      return json(res, 200, { ...entry, channels: JSON.parse(entry.channels), sections: JSON.parse(entry.sections) })
    }
  }

  if (m = HISTORY_LIST.exec(pathname)) {
    if (method === 'GET') {
      return json(res, 200, listHistory(m[1]))
    }
  }

  return null
}

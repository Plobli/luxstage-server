import { readShowSectionDefs, readShowSections, writeShowSectionDefs, writeShowSections } from '../db/sections.js'
import { requireShow } from '../db/shows.js'
import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'
import { withUndoSnapshot } from '../db/operations.js'

const SHOW_SECTIONS      = /^\/api\/shows\/([^/]+)\/sections$/
const SHOW_SECTION_DEFS  = /^\/api\/shows\/([^/]+)\/section-defs$/

export async function sectionRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_SECTIONS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const map = readShowSections(slug)
      return json(res, 200, [...map.entries()].map(([id, content]) => ({ id, content })))
    }
    if (method === 'PUT') {
      const user = req.user
      const sections = await readJsonBody(req, res); if (sections === null) return

      const show = requireShow(slug, res)
      if (!show) return

      const map = new Map(sections.map(s => [s.id, s.content]))
      withUndoSnapshot(slug, show.id, user.username, () => {
        writeShowSections(slug, map, user.username)
      })
      broadcast(slug, 'sections-updated', { updatedBy: user.username })
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_SECTION_DEFS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      return json(res, 200, readShowSectionDefs(slug))
    }
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return

      const show = requireShow(slug, res)
      if (!show) return

      withUndoSnapshot(slug, show.id, user.username, () => {
        writeShowSectionDefs(slug, body.sections, user.username)
      })
      broadcast(slug, 'sections-updated', { updatedBy: user.username })
      return json(res, 200, { ok: true })
    }
  }

  return null
}

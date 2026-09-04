import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'
import { applySections } from './template-apply.js'

function now() { return Date.now() }

export function touchLastEdited(showId, username) {
  getDb().prepare('UPDATE shows SET last_edited_by = ?, last_edited_at = ? WHERE id = ?')
    .run(username, now(), showId)
}

export function listShows() {
  return getDb().prepare('SELECT * FROM shows WHERE archived = 0 ORDER BY created_at DESC').all()
}

export function listArchivedShows() {
  return getDb().prepare('SELECT * FROM shows WHERE archived = 1 ORDER BY created_at DESC').all()
}

export function readShow(slug) {
  return getDb().prepare('SELECT * FROM shows WHERE slug = ?').get(slug) ?? null
}

// Show per Slug laden oder selbst mit 404 antworten — vermeidet die in jedem
// Route-Handler wiederholte "const show = readShow(slug); if (!show) return
// json(res, 404, ...)"-Prüfung (analog zu requireAuth in auth.js: schreibt die
// Antwort direkt, damit Aufrufer nur noch `if (!show) return` brauchen).
export function requireShow(slug, res) {
  const show = readShow(slug)
  if (!show) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Show nicht gefunden' }))
    return null
  }
  return show
}

export function writeShow(slug, fields) {
  const allowed = ['name', 'datum', 'template', 'spielzeit', 'setup_markdown', 'eos_active_channels', 'eos_excluded_channels', 'last_edited_by', 'last_edited_at', 'use_bars', 'use_towers']
  const updates = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  )
  if (!Object.keys(updates).length) return
  const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
  getDb().prepare(`UPDATE shows SET ${sets}, updated_at = @updated_at WHERE slug = @slug`)
    .run({ ...updates, updated_at: now(), slug })
}

export function createShow(slug, fields) {
  const tx = getDb().transaction(() => {
    const id = randomUUID()
    const ts = now()
    getDb().prepare(`
      INSERT INTO shows (id, slug, name, datum, template, spielzeit, archived, use_bars, use_towers, created_at, updated_at)
      VALUES (@id, @slug, @name, @datum, @template, @spielzeit, 0, @use_bars, @use_towers, @ts, @ts)
    `).run({
      id, slug,
      name: fields.name ?? slug,
      datum: fields.datum ?? new Date().toISOString().slice(0, 10),
      template: fields.template ?? null,
      spielzeit: fields.spielzeit ?? null,
      use_bars: fields.use_bars !== false ? 1 : 0,
      use_towers: fields.use_towers !== false ? 1 : 0,
      ts,
    })

    // Sections-Kopie nutzt dieselbe applySections() wie applyTemplateToShow()/
    // applyTemplateToAllShows() (siehe db/template-apply.js) statt einer
    // eigenen dritten Kopie der "Template-Bereiche übernehmen"-Logik. Bars/
    // Towers werden hier bewusst NICHT kopiert — Aufrufer (useShowWizard.js)
    // rufen dafür explizit applyTemplateToShow() mit der vom Nutzer getroffenen
    // Auswahl auf, nachdem die Show existiert.
    if (fields.template && fields.importSections !== false) {
      const tpl = getDb().prepare('SELECT * FROM templates WHERE name = ?').get(fields.template)
      if (tpl) applySections(tpl, { id }, null)
    }
  })
  tx()
}

export function archiveShow(slug) {
  getDb().prepare('UPDATE shows SET archived = 1, updated_at = ? WHERE slug = ?').run(now(), slug)
}

export function restoreShow(slug) {
  getDb().prepare('UPDATE shows SET archived = 0, updated_at = ? WHERE slug = ?').run(now(), slug)
}

export function deleteShow(slug) {
  getDb().prepare('DELETE FROM shows WHERE slug = ?').run(slug)
}

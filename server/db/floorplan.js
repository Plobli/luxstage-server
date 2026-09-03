import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'
import { readShow } from './shows.js'

function now() { return Date.now() }

export function getTemplateFloorplan(templateId) {
  return getDb().prepare(
    'SELECT * FROM template_floorplans WHERE template_id = ?'
  ).get(templateId) ?? null
}

export function upsertTemplateFloorplan(templateId, imagePath) {
  const existing = getTemplateFloorplan(templateId)
  if (existing) {
    getDb().prepare(
      'UPDATE template_floorplans SET image_path = ? WHERE template_id = ?'
    ).run(imagePath, templateId)
  } else {
    getDb().prepare(
      'INSERT INTO template_floorplans (id, template_id, image_path, created_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), templateId, imagePath, now())
  }
}

export function upsertTemplateFloorplanData(templateId, canvasData) {
  const existing = getTemplateFloorplan(templateId)
  if (existing) {
    getDb().prepare(
      'UPDATE template_floorplans SET canvas_data = ? WHERE template_id = ?'
    ).run(canvasData, templateId)
  } else {
    getDb().prepare(
      'INSERT INTO template_floorplans (id, template_id, canvas_data, created_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), templateId, canvasData, now())
  }
}

export function getShowFloorplan(showId) {
  return getDb().prepare(
    'SELECT * FROM show_floorplan_layers WHERE show_id = ?'
  ).get(showId) ?? null
}

export function upsertShowFloorplanImage(showId, imagePath) {
  const existing = getShowFloorplan(showId)
  if (existing) {
    getDb().prepare(
      'UPDATE show_floorplan_layers SET image_path = ?, updated_at = ? WHERE show_id = ?'
    ).run(imagePath, now(), showId)
  } else {
    getDb().prepare(
      'INSERT INTO show_floorplan_layers (id, show_id, image_path, updated_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), showId, imagePath, now())
  }
}

export function upsertShowFloorplanData(showId, canvasData) {
  const existing = getShowFloorplan(showId)
  if (existing) {
    getDb().prepare(
      'UPDATE show_floorplan_layers SET canvas_data = ?, updated_at = ? WHERE show_id = ?'
    ).run(canvasData, now(), showId)
  } else {
    getDb().prepare(
      'INSERT INTO show_floorplan_layers (id, show_id, canvas_data, updated_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), showId, canvasData, now())
  }
}

// Für den atomaren Show-Zustand (server/db/full-state.js) — Undo/Redo behandelt den Grundriss
// wie Kanäle/Sections/Türme/Stangen: ein Feld im gemeinsamen Snapshot, per Slug statt der
// sonst hier üblichen show_id-UUID adressiert (löst show.id intern auf, wie readTowers/
// restoreTowers es für ihre Tabellen tun).
export function readFloorplanForState(slug) {
  const show = readShow(slug)
  const layer = show ? getShowFloorplan(show.id) : null
  return { canvas_data: layer?.canvas_data ?? null, image_path: layer?.image_path ?? null }
}

export function restoreFloorplan(slug, floorplanState) {
  const show = readShow(slug)
  if (!show) return
  upsertShowFloorplanData(show.id, floorplanState?.canvas_data ?? null)
  upsertShowFloorplanImage(show.id, floorplanState?.image_path ?? null)
}

import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'
import { readShow } from './shows.js'

function now() { return Date.now() }

export function getTemplateDrawingPlan(templateId) {
  return getDb().prepare(
    'SELECT * FROM template_drawing_plans WHERE template_id = ?'
  ).get(templateId) ?? null
}

export function upsertTemplateDrawingPlan(templateId, imagePath) {
  const existing = getTemplateDrawingPlan(templateId)
  if (existing) {
    getDb().prepare(
      'UPDATE template_drawing_plans SET image_path = ? WHERE template_id = ?'
    ).run(imagePath, templateId)
  } else {
    getDb().prepare(
      'INSERT INTO template_drawing_plans (id, template_id, image_path, created_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), templateId, imagePath, now())
  }
}

export function upsertTemplateDrawingPlanData(templateId, canvasData) {
  const existing = getTemplateDrawingPlan(templateId)
  if (existing) {
    getDb().prepare(
      'UPDATE template_drawing_plans SET canvas_data = ? WHERE template_id = ?'
    ).run(canvasData, templateId)
  } else {
    getDb().prepare(
      'INSERT INTO template_drawing_plans (id, template_id, canvas_data, created_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), templateId, canvasData, now())
  }
}

export function getShowDrawingPlan(showId) {
  return getDb().prepare(
    'SELECT * FROM show_drawing_plan_layers WHERE show_id = ?'
  ).get(showId) ?? null
}

export function upsertShowDrawingPlanImage(showId, imagePath) {
  const existing = getShowDrawingPlan(showId)
  if (existing) {
    getDb().prepare(
      'UPDATE show_drawing_plan_layers SET image_path = ?, updated_at = ? WHERE show_id = ?'
    ).run(imagePath, now(), showId)
  } else {
    getDb().prepare(
      'INSERT INTO show_drawing_plan_layers (id, show_id, image_path, updated_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), showId, imagePath, now())
  }
}

export function upsertShowDrawingPlanData(showId, canvasData) {
  const existing = getShowDrawingPlan(showId)
  if (existing) {
    getDb().prepare(
      'UPDATE show_drawing_plan_layers SET canvas_data = ?, updated_at = ? WHERE show_id = ?'
    ).run(canvasData, now(), showId)
  } else {
    getDb().prepare(
      'INSERT INTO show_drawing_plan_layers (id, show_id, canvas_data, updated_at) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), showId, canvasData, now())
  }
}

// Für den atomaren Show-Zustand (server/db/full-state.js) — Undo/Redo behandelt den Grundriss
// wie Kanäle/Sections/Türme/Stangen: ein Feld im gemeinsamen Snapshot, per Slug statt der
// sonst hier üblichen show_id-UUID adressiert (löst show.id intern auf, wie readTowers/
// restoreTowers es für ihre Tabellen tun).
export function readDrawingPlanForState(slug) {
  const show = readShow(slug)
  const layer = show ? getShowDrawingPlan(show.id) : null
  return { canvas_data: layer?.canvas_data ?? null, image_path: layer?.image_path ?? null }
}

export function restoreDrawingPlan(slug, drawingPlanState) {
  const show = readShow(slug)
  if (!show) return
  upsertShowDrawingPlanData(show.id, drawingPlanState?.canvas_data ?? null)
  upsertShowDrawingPlanImage(show.id, drawingPlanState?.image_path ?? null)
}

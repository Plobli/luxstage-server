import { hasColumn, addColumnIfMissing } from './helpers.js'

// template_floorplans: canvas_data nachträglich hinzugefügt
export const id = '008-template-floorplans-canvas-data'

export function alreadyApplied(db) {
  return hasColumn(db, 'template_floorplans', 'canvas_data')
}

export function up(db) {
  addColumnIfMissing(db, 'template_floorplans', 'canvas_data', 'TEXT')
}

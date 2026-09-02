// Undo/Redo für Shows — Konfiguration der gemeinsamen Stack-Mechanik.
// Die Signaturen bleiben unverändert, alle Aufrufer in routes/ sind nicht betroffen.
import { readFullShowState, computeStateHash } from './full-state.js'
import { makeUndoStack } from './undo-stack.js'

const stack = makeUndoStack({
  opTable: 'operations',
  redoTable: 'redo_stack',
  scopeColumn: 'show_id',
  readState: readFullShowState,
  hashState: computeStateHash,
})

export const recordSnapshot = (showId, username, stateBefore) => stack.record(showId, username, stateBefore)
export const getLastOperation = showId => stack.getLast(showId)
export const deleteOperation = id => stack.deleteEntry(id)
export const pushRedo = (showId, state) => stack.pushRedo(showId, state)
export const popRedo = showId => stack.popRedo(showId)
export const clearRedo = showId => stack.clearRedo(showId)

export const withUndoSnapshot = (slug, showId, username, mutate) =>
  stack.withSnapshot(showId, slug, username, mutate)

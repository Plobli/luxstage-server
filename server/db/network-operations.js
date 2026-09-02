// server/db/network-operations.js
// Serverseitiges Undo/Redo fürs Netzwerk — dieselbe Mechanik wie operations.js
// für Shows, aber als einziger globaler Stack (kein show_id).
import { readFullNetworkState, computeNetworkStateHash } from './network-state.js'
import { makeUndoStack } from './undo-stack.js'

const stack = makeUndoStack({
  opTable: 'network_operations',
  redoTable: 'network_redo_stack',
  scopeColumn: null,
  readState: readFullNetworkState,
  hashState: computeNetworkStateHash,
})

export const recordNetworkSnapshot = (username, stateBefore) => stack.record(null, username, stateBefore)
export const getLastNetworkOperation = () => stack.getLast(null)
export const deleteNetworkOperation = id => stack.deleteEntry(id)
export const pushNetworkRedo = state => stack.pushRedo(null, state)
export const popNetworkRedo = () => stack.popRedo(null)
export const clearNetworkRedo = () => stack.clearRedo(null)

export const withNetworkUndoSnapshot = (username, mutate) =>
  stack.withSnapshot(null, undefined, username, mutate)

import { ref } from 'vue'

/**
 * Rein clientseitige Undo/Redo-Historie für den FloorplanEditor: ein Stack
 * aus Snapshots, ohne Serverkontakt — anders als useUndoRedo.ts, das den
 * serverseitigen Show-/Netzwerk-Stack abbildet. Ein Snapshot ist bewusst ein
 * beliebiger, vom Aufrufer definierter Wert (hier ein JSON-String aus
 * exportData()/parseData()), damit kein zusätzlicher Clone-Schritt nötig ist.
 */
export function useEditorHistory({ exportSnapshot, applySnapshot, limit = 100 }) {
  const history = ref([])
  const historyIndex = ref(-1)

  function push() {
    const snap = exportSnapshot()
    let h = history.value.slice(0, historyIndex.value + 1)
    h.push(snap)
    if (h.length > limit) h = h.slice(-limit)
    history.value = h
    historyIndex.value = history.value.length - 1
  }

  // undo()/redo() geben den wiederhergestellten Snapshot zurück (oder null am
  // Rand des Stacks), damit der Aufrufer z.B. ein 'change'-Event nur bei einer
  // tatsächlichen Änderung auslöst.
  function undo() {
    if (historyIndex.value <= 0) return null
    historyIndex.value--
    const snap = history.value[historyIndex.value]
    applySnapshot(snap)
    return snap
  }

  function redo() {
    if (historyIndex.value >= history.value.length - 1) return null
    historyIndex.value++
    const snap = history.value[historyIndex.value]
    applySnapshot(snap)
    return snap
  }

  function reset(snapshot) {
    history.value = [snapshot]
    historyIndex.value = 0
  }

  return { push, undo, redo, reset }
}

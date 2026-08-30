// web-app/src/composables/useUndoRedo.ts
import { ref, type ComputedRef, computed } from 'vue'
import { undoShow, redoShow } from '../api/shows.js'
import { ApiError } from '../api/client.js'

export interface UseUndoRedoReturn {
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
  markSaved: () => void;
}

/**
 * Undo/Redo läuft serverseitig (operations-Tabelle, ein Eintrag pro Save) —
 * dieses Composable ruft nur noch die Endpunkte auf und reagiert auf 400
 * (Stack leer) bzw. 423 (Show durch anderen User gesperrt).
 *
 * undo()/redo() geben zurück, ob serverseitig wirklich etwas rückgängig
 * gemacht/wiederholt wurde — der Aufrufer muss danach die betroffenen Daten
 * (Kanäle, Sections, Türme, Bars) neu laden, da der Server sie nur ändert,
 * aber nicht automatisch an den Client zurücksendet.
 */
export function useUndoRedo(showId: string, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void): UseUndoRedoReturn {
  // Der Server kennt die Stack-Tiefe nicht als eigenen Endpunkt — canUndo/canRedo
  // starten optimistisch offen und schalten erst bei einem 400 (Stack leer) ab.
  // Ein erfolgreicher Undo/Redo oder ein neuer Save (markSaved) öffnet canUndo wieder.
  const canUndo = ref(true)
  const canRedo = ref(true)

  async function undo(): Promise<boolean> {
    try {
      await undoShow(showId)
      canUndo.value = true
      canRedo.value = true
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) { canUndo.value = false; return false }
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return false }
      throw e
    }
  }

  async function redo(): Promise<boolean> {
    try {
      await redoShow(showId)
      canUndo.value = true
      canRedo.value = true
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) { canRedo.value = false; return false }
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return false }
      throw e
    }
  }

  function markSaved(): void {
    canUndo.value = true
  }

  return { undo, redo, canUndo: computed(() => canUndo.value), canRedo: computed(() => canRedo.value), markSaved }
}

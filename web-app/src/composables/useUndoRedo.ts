// web-app/src/composables/useUndoRedo.ts
import { ref, type ComputedRef, computed } from 'vue'
import { undoShow, redoShow } from '../api/shows.js'
import { ApiError } from '../api/client.js'

export interface UseUndoRedoReturn {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
}

/**
 * Undo/Redo läuft serverseitig (operations-Tabelle, ein Eintrag pro Save) —
 * dieses Composable ruft nur noch die Endpunkte auf und reagiert auf 400
 * (Stack leer) bzw. 423 (Show durch anderen User gesperrt).
 */
export function useUndoRedo(showId: string, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void): UseUndoRedoReturn {
  // Der Server kennt die Stack-Tiefe nicht als eigenen Endpunkt — canUndo/canRedo
  // starten optimistisch offen und schalten erst bei einem 400 (Stack leer) ab.
  // Ein neuer Save öffnet canUndo wieder (siehe resetAfterSave).
  const canUndo = ref(true)
  const canRedo = ref(true)

  async function undo(): Promise<void> {
    try {
      await undoShow(showId)
      canRedo.value = true
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) { canUndo.value = false; return }
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
  }

  async function redo(): Promise<void> {
    try {
      await redoShow(showId)
      canUndo.value = true
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) { canRedo.value = false; return }
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
  }

  return { undo, redo, canUndo: computed(() => canUndo.value), canRedo: computed(() => canRedo.value) }
}

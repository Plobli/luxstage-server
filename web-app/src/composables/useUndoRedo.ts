// web-app/src/composables/useUndoRedo.ts
import { ref, type ComputedRef, type Ref, computed } from 'vue'
import { undoShow, redoShow } from '../api/shows.js'
import { ApiError } from '../api/client.js'

export interface UseUndoRedoReturn {
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
  markSaved: () => void;
  onUndoRedoKeydown: (e: KeyboardEvent) => void;
}

/**
 * Undo/Redo läuft serverseitig (operations-Tabelle, ein Eintrag pro Save) —
 * dieses Composable ruft nur noch die Endpunkte auf und reagiert auf 400
 * (Stack leer) bzw. 423 (Show durch anderen User gesperrt).
 *
 * `onAfter` lädt die betroffenen Daten (Kanäle, Sections, Türme, Bars) nach
 * jedem erfolgreichen Undo/Redo neu — der Server ändert sie nur, sendet den
 * neuen Stand aber nicht automatisch zurück.
 */
export function useUndoRedo(
  showId: string,
  onLockConflict?: (body: { lockedBy?: string, since?: number }) => void,
  onAfter?: () => void | Promise<void>,
  onAfterError?: (e: unknown) => void,
): UseUndoRedoReturn {
  return useServerUndoRedo({
    undo: () => undoShow(showId),
    redo: () => redoShow(showId),
    onLockConflict,
    onAfter,
    onAfterError,
  })
}

/**
 * Die Mechanik hinter useUndoRedo, ohne Bindung an Shows: dieselbe optimistische
 * canUndo/canRedo-Führung und dasselbe Fehler-Mapping für jeden serverseitigen
 * Undo/Redo-Stack. Genutzt von Shows und der Netzwerk-Ansicht.
 */
export function useServerUndoRedo({ undo: undoCall, redo: redoCall, onLockConflict, onAfter, onAfterError }: {
  undo: () => Promise<unknown>;
  redo: () => Promise<unknown>;
  onLockConflict?: (body: { lockedBy?: string, since?: number }) => void;
  /** Wird nach jedem erfolgreichen Undo/Redo aufgerufen — zum Nachladen der Daten. */
  onAfter?: () => void | Promise<void>;
  /** Fehler aus onAfter() — getrennt von einem fehlgeschlagenen Undo/Redo selbst
   *  (siehe run()): der Undo/Redo-Call war bereits erfolgreich, nur das
   *  Nachladen ist gescheitert. Ohne diese Trennung zeigte die UI "Speichern
   *  fehlgeschlagen", obwohl der Undo/die Redo serverseitig durchging. */
  onAfterError?: (e: unknown) => void;
}): UseUndoRedoReturn {
  // Der Server kennt die Stack-Tiefe nicht als eigenen Endpunkt. canUndo startet
  // optimistisch offen, canRedo optimistisch geschlossen (Redo-Stack ist nach dem
  // Laden bzw. nach jedem Save immer leer). Beide schalten bei 400 (Stack leer) ab;
  // ein erfolgreicher Undo öffnet canRedo, ein erfolgreicher Redo/Save öffnet canUndo.
  const canUndo = ref(true)
  const canRedo = ref(false)

  async function run(call: () => Promise<unknown>, exhausted: Ref<boolean>): Promise<boolean> {
    try {
      await call()
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) { exhausted.value = false; return false }
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return false }
      throw e
    }
    canUndo.value = true
    canRedo.value = true
    // Getrennt vom obigen try/catch: der Undo/Redo-Call selbst ist bereits
    // durch — ein Fehler beim Nachladen darf nicht als fehlgeschlagenes
    // Undo/Redo interpretiert werden (siehe onAfterError-Doku oben).
    try {
      await onAfter?.()
    } catch (e) {
      onAfterError?.(e)
    }
    return true
  }

  const undo = () => run(undoCall, canUndo)
  const redo = () => run(redoCall, canRedo)

  function markSaved(): void {
    canUndo.value = true
    canRedo.value = false
  }

  // Greift bewusst auch bei fokussiertem Eingabefeld: Undo/Redo läuft auf der
  // letzten gespeicherten Aktion, nicht auf Zeichen-Ebene (sonst finge der
  // Browser Cmd+Z/Cmd+Shift+Z selbst ab, z.B. als Fenster-Kürzel in Safari).
  function onUndoRedoKeydown(e: KeyboardEvent): void {
    const isMac = (navigator as any).userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent)
    const mod = isMac ? e.metaKey : e.ctrlKey

    if (mod && !e.shiftKey && e.key === 'z') {
      e.preventDefault()
      undo().catch(err => console.error('[undo] fehlgeschlagen:', err))
    } else if (
      (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) ||
      (!isMac && mod && e.key === 'y')
    ) {
      e.preventDefault()
      redo().catch(err => console.error('[redo] fehlgeschlagen:', err))
    }
  }

  return {
    undo, redo,
    canUndo: computed(() => canUndo.value),
    canRedo: computed(() => canRedo.value),
    markSaved,
    onUndoRedoKeydown,
  }
}

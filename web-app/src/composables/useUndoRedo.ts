// web-app/src/composables/useUndoRedo.ts
import { ref, computed, toRaw, type ComputedRef, type Ref } from 'vue'

const MAX_HISTORY = 50

/**
 * Undo/Redo wie in Word.
 */
export interface UseUndoRedoReturn {
  initSnapshot: () => void;
  recordFocus: () => void;
  commitFocus: () => void;
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
}

export function useUndoRedo<T>(
  getState: () => T, 
  applyState: (snapshot: T) => void, 
  cancelPendingSaves: () => void, 
  saveNow: () => void = () => {}
): UseUndoRedoReturn {
  // Use unknown as intermediate to avoid deep nested ref issues if T is complex
  const past = ref<T[]>([]) as Ref<T[]>
  const future = ref<T[]>([]) as Ref<T[]>

  let focusSnapshot: T | null = null  // Zustand beim letzten @focus

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────

  function _deepRaw(val: any): any {
    if (Array.isArray(val)) return val.map(item => _deepRaw(toRaw(item)))
    if (val && typeof val === 'object') {
      const raw = toRaw(val)
      const result: any = {}
      for (const key of Object.keys(raw)) result[key] = _deepRaw(raw[key])
      return result
    }
    return val
  }

  function _cloneState(): T {
    return structuredClone(_deepRaw(getState()))
  }

  function _push(snapshot: T): void {
    future.value = []
    past.value.push(snapshot)
    if (past.value.length > MAX_HISTORY) past.value.shift()
  }

  // ── Öffentliche API ───────────────────────────────────────────────────────

  /** Beim Öffnen einer Show: sauberer Ausgangspunkt. */
  function initSnapshot(): void {
    focusSnapshot = null
    try {
      past.value = [_cloneState()]
    } catch (e) {
      console.error('[useUndoRedo] initSnapshot fehlgeschlagen:', e)
      past.value = []
    }
    future.value = []
  }

  /** @focus auf einem Textfeld — merkt sich den Zustand VOR der Eingabe. */
  function recordFocus(): void {
    try {
      focusSnapshot = _cloneState()
    } catch (e) {
      console.error('[useUndoRedo] recordFocus fehlgeschlagen:', e)
      focusSnapshot = null
    }
  }

  /** @blur auf einem Textfeld — pusht focusSnapshot falls sich etwas geändert hat. */
  function commitFocus(): void {
    if (!focusSnapshot) return
    try {
      const current = _cloneState()
      if (JSON.stringify(current) !== JSON.stringify(focusSnapshot)) {
        _push(focusSnapshot as T)
      }
    } catch (e) {
      console.error('[useUndoRedo] commitFocus fehlgeschlagen:', e)
    }
    focusSnapshot = null
  }

  /** VOR einer destruktiven Aktion aufrufen (löschen, drag&drop, import etc.). */
  function pushSnapshot(): void {
    focusSnapshot = null
    try { _push(_cloneState()) }
    catch (e) { console.error('[useUndoRedo] pushSnapshot fehlgeschlagen:', e) }
  }

  function undo(): void {
    focusSnapshot = null
    if (past.value.length <= 1) return
    const current = _cloneState()
    future.value.unshift(current)
    const prev = past.value.pop()
    cancelPendingSaves()
    if (prev !== undefined) applyState(prev)
    saveNow()
  }

  function redo(): void {
    focusSnapshot = null
    if (!future.value.length) return
    const current = _cloneState()
    past.value.push(current)
    const next = future.value.shift()
    cancelPendingSaves()
    if (next !== undefined) applyState(next)
    saveNow()
  }

  const canUndo = computed(() => past.value.length > 1)
  const canRedo = computed(() => future.value.length > 0)

  return { initSnapshot, recordFocus, commitFocus, pushSnapshot, undo, redo, canUndo, canRedo }
}



import { ApiError } from '../api/client'

// Kapselt das wiederkehrende Muster "API-Call, bei 423 (Show gesperrt) onLockConflict
// aufrufen und abbrechen, sonst weiterwerfen" — siehe useShowBars.ts/useShowTowers.ts.
// NICHT geeignet für Stellen, die den Lock-Conflict selbst als regulären Rückgabewert
// behandeln (useShowLock.ts: { ok: false, ... }), einen anderen Fallback-Rückgabewert
// als undefined brauchen (useUndoRedo.ts: false), oder bei Nicht-423-Fehlern NICHT
// weiterwerfen dürfen, weil sie fire-and-forget ohne .catch() am Aufrufort laufen und
// stattdessen lokal einen Error-State setzen (useShowChannels.ts doPersistChannels/
// persistEosChannels, useShowSections.ts doPersistSections/persistSectionDefs — dort
// würde withLockConflict die Nicht-423-Fehlerbehandlung kaputt machen).
export function withLockConflict<T extends unknown[], R>(
  onLockConflict: ((body: { lockedBy?: string, since?: number }) => void) | undefined,
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R | void> {
  return async (...args: T) => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body ?? {}); return }
      throw e
    }
  }
}

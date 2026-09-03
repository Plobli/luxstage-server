import { ApiError } from '../api/client'

// Kapselt das wiederkehrende Muster "API-Call, bei 423 (Show gesperrt) onLockConflict
// aufrufen und abbrechen, sonst weiterwerfen" — siehe useShowBars.ts/useShowTowers.ts/
// useShowSections.ts/useShowChannels.ts. NICHT geeignet für Stellen, die den Lock-Conflict
// selbst als regulären Rückgabewert behandeln (useShowLock.ts: { ok: false, ... }) oder einen
// anderen Fallback-Rückgabewert als undefined brauchen (useUndoRedo.ts: false).
export function withLockConflict<T extends unknown[], R>(
  onLockConflict: ((body: { lockedBy?: string, since?: number }) => void) | undefined,
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R | void> {
  return async (...args: T) => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
  }
}

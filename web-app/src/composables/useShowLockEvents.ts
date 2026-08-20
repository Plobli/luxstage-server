import { ref } from 'vue'
import { subscribeShow } from '../api/client'

export interface ShowLock {
  user: string;
  since: number;
}

export interface LockEventCallbacks {
  onTakeoverRequested?: (data: { requestedBy: string }) => void;
  onLockStatus?: (data: { lock: ShowLock | null }) => void;
}

export function useShowLockEvents(showId: string, callbacks: LockEventCallbacks) {
  const lock = ref<ShowLock | null>(null)
  let unsubscribeSSE: (() => void) | null = null

  function initLockEvents(): void {
    unsubscribeSSE = subscribeShow(showId, {
      onLockStatus: callbacks.onLockStatus,
      onTakeoverRequested: callbacks.onTakeoverRequested,
    })
  }

  function cleanupLockEvents(): void {
    unsubscribeSSE?.()
  }

  return {
    lock,
    initLockEvents,
    cleanupLockEvents
  }
}

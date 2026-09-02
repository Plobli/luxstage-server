import { ref } from 'vue'
import { subscribeShow, type ShowPresenceUser } from '../api/client'
import { currentUsername } from '../api/currentUser'

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
  // Wer die Show gerade offen hat — der Server sendet die Liste bei jedem
  // Verbinden und Trennen. Rein informativ, unabhängig von der Schreibsperre.
  const presentUsers = ref<ShowPresenceUser[]>([])
  let unsubscribeSSE: (() => void) | null = null

  function initLockEvents(): void {
    unsubscribeSSE = subscribeShow(showId, {
      onLockStatus: callbacks.onLockStatus,
      onTakeoverRequested: callbacks.onTakeoverRequested,
      // Der eigene Zugang zählt nicht als Mitleser — angezeigt werden nur andere.
      onPresence: ({ users }) => {
        const me = currentUsername()
        presentUsers.value = (users ?? []).filter(u => u.username !== me)
      },
    })
  }

  function cleanupLockEvents(): void {
    unsubscribeSSE?.()
    presentUsers.value = []
  }

  return {
    lock,
    presentUsers,
    initLockEvents,
    cleanupLockEvents
  }
}

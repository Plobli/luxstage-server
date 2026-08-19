import { ref } from 'vue'
import { subscribeShow } from '../api/client'

export interface PresenceUser {
  username: string;
  device: string;
  [key: string]: any;
}

export interface ShowLock {
  user: string;
  since: number;
}

export interface PresenceCallbacks {
  onChannels?: (data: any) => void;
  onSections?: (data: any) => void;
  onTowers?: (data: any) => void;
  onBars?: (data: any) => void;
  onTakeoverRequested?: (data: { requestedBy: string }) => void;
  onLockStatus?: (data: { lock: ShowLock | null }) => void;
}

export function useShowPresence(showId: string, callbacks: PresenceCallbacks) {
  const presence = ref<PresenceUser[]>([])
  const lock = ref<ShowLock | null>(null)
  let unsubscribeSSE: (() => void) | null = null

  function initPresence(): void {
    unsubscribeSSE = subscribeShow(showId, {
      onChannels: callbacks.onChannels,
      onSections: callbacks.onSections,
      onTowers: callbacks.onTowers,
      onBars: callbacks.onBars,
      onPresence: ({ users }: { users: PresenceUser[] }) => {
        presence.value = users
      },
      onLockStatus: callbacks.onLockStatus,
      onTakeoverRequested: callbacks.onTakeoverRequested,
    })
  }

  function cleanupPresence(): void {
    unsubscribeSSE?.()
  }

  return {
    presence,
    lock,
    initPresence,
    cleanupPresence
  }
}


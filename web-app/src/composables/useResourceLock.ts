import { ref, computed } from 'vue'
import { ApiError } from '../api/client'
import { currentUsername } from '../api/currentUser'

const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000 // deutlich unter config.lockTimeout (10 Minuten)

export interface ResourceLockState {
  user: string
  since: number
}

export interface ResourceLockApi {
  acquire: () => Promise<{ ok: boolean, lockedBy?: string, since?: number }>
  release: () => Promise<unknown>
  touch: () => Promise<unknown>
}

/**
 * Vereinfachte Variante von useShowLock für Ressourcen ohne eigene SSE-
 * Subscription (Netzwerk, Templates — siehe server/db/resource-locks.js):
 * Akquise beim Öffnen, Heartbeat solange offen, Freigabe beim Verlassen.
 * Anders als bei Shows gibt es keinen Live-Broadcast bei Statusänderungen —
 * der Lock-Stand aktualisiert sich nur bei eigenen Aktionen (Akquise, 423 aus
 * einem Schreibversuch, Heartbeat). Kein Takeover-Request-Flow.
 */
export function useResourceLock(api: ResourceLockApi) {
  const lock = ref<ResourceLockState | null>(null)
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  const isHeldByMe = computed(() => lock.value?.user === currentUsername())
  const isLockedByOther = computed(() => !!lock.value && !isHeldByMe.value)

  function stopHeartbeat(): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  function startHeartbeat(): void {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (isHeldByMe.value) {
        api.touch().catch(e => {
          if (e instanceof ApiError && e.status === 423) syncLockFromConflict(e.body)
        })
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  async function acquireOnOpen(): Promise<void> {
    try {
      await api.acquire()
      lock.value = { user: currentUsername()!, since: Date.now() }
      startHeartbeat()
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        lock.value = { user: e.body.lockedBy, since: e.body.since }
        return
      }
      throw e
    }
  }

  // Bei jedem 423 aus einem Schreibversuch den lokalen Lock-Stand sofort aus
  // der Fehlerantwort übernehmen — sonst bliebe die UI editierbar, obwohl der
  // Server bereits ablehnt (z.B. wenn der Lock erst nach dem Öffnen von
  // jemand anderem übernommen wurde).
  function syncLockFromConflict(body: { lockedBy?: string, since?: number }): void {
    if (!body?.lockedBy) return
    stopHeartbeat()
    lock.value = { user: body.lockedBy, since: body.since ?? Date.now() }
  }

  async function releaseOnClose(): Promise<void> {
    stopHeartbeat()
    if (isHeldByMe.value) {
      try { await api.release() } catch { /* best effort, Server-Timeout greift sonst */ }
    }
  }

  return { lock, isHeldByMe, isLockedByOther, acquireOnOpen, releaseOnClose, syncLockFromConflict }
}

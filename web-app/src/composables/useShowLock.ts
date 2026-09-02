import { ref, computed, type Ref } from 'vue'
import { acquireShowLock, releaseShowLock, touchShowLock, requestLockTakeover, type LockResult } from '../api/shows.js'
import { ApiError } from '../api/client.js'
import { currentUsername } from '../api/currentUser.js'
import type { ShowLock } from './useShowLockEvents.js'

const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000 // deutlich unter config.lockTimeout (10 Minuten)

/**
 * Verwaltet den Show-weiten Schreib-Lock im Frontend: Akquise beim Öffnen,
 * periodischer Heartbeat solange die Show offen ist, Freigabe beim Verlassen.
 * `lock` (aus useShowLockEvents, per SSE aktuell gehalten) bestimmt, ob der
 * aktuelle User schreiben darf.
 */
export function useShowLock(showId: string, lock: Ref<ShowLock | null>) {
  const takeoverRequestedBy = ref<string | null>(null)
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  const isHeldByMe = computed(() => lock.value?.user === currentUsername())
  const isLockedByOther = computed(() => !!lock.value && !isHeldByMe.value)

  function startHeartbeat(): void {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (isHeldByMe.value) touchShowLock(showId).catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  async function acquireOnOpen(): Promise<LockResult> {
    // Bei 423 wirft der API-Client eine ApiError (HTTP-Status außerhalb 2xx),
    // acquireShowLock() liefert also nur bei Erfolg ein reguläres Ergebnis.
    try {
      const result = await acquireShowLock(showId)
      lock.value = { user: currentUsername()!, since: Date.now() }
      startHeartbeat()
      return result
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        lock.value = { user: e.body.lockedBy, since: e.body.since }
        return { ok: false, lockedBy: e.body.lockedBy, since: e.body.since }
      }
      throw e
    }
  }

  /**
   * Bei jedem 423 aus einem Save-Aufruf (channels, sections, meta, …) den
   * lokalen Lock-Stand sofort aus der Fehlerantwort übernehmen — sonst bleibt
   * die UI editierbar, obwohl der Server bereits ablehnt (z.B. wenn der Lock
   * erst nach dem Öffnen der Show von einem anderen User übernommen wurde).
   */
  function syncLockFromConflict(body: { lockedBy?: string, since?: number }): void {
    if (!body?.lockedBy) return
    stopHeartbeat()
    lock.value = { user: body.lockedBy, since: body.since ?? Date.now() }
  }

  async function releaseOnClose(): Promise<void> {
    stopHeartbeat()
    if (isHeldByMe.value) {
      try { await releaseShowLock(showId) } catch { /* best effort, Server-Timeout greift sonst */ }
    }
  }

  async function requestTakeover(): Promise<void> {
    await requestLockTakeover(showId)
  }

  async function releaseForOther(): Promise<void> {
    stopHeartbeat()
    // Direkte Übergabe statt Freigabe + Rennen: sonst könnte ein Dritter
    // (oder der Freigebende selbst erneut) den Lock im selben Moment schnappen,
    // obwohl explizit der anfragende User übernehmen sollte.
    await releaseShowLock(showId, takeoverRequestedBy.value ?? undefined)
    takeoverRequestedBy.value = null
  }

  function onTakeoverRequested({ requestedBy }: { requestedBy: string }): void {
    if (isHeldByMe.value) takeoverRequestedBy.value = requestedBy
  }

  function dismissTakeoverRequest(): void {
    takeoverRequestedBy.value = null
  }

  /**
   * Wird der Lock frei (Freigabe oder Timeout eines anderen Users), versucht
   * jeder offene Tab automatisch, ihn zu übernehmen — der Server entscheidet
   * per Race, wer zuerst ankommt; alle anderen bleiben weiterhin gesperrt.
   * Ohne das bliebe "kein Lock aktiv" fälschlich gleichbedeutend mit "ich darf
   * schreiben", obwohl niemand ihn tatsächlich akquiriert hat.
   */
  function onLockStatusChanged({ lock: newLock }: { lock: ShowLock | null }): void {
    if (newLock) {
      lock.value = newLock
      if (newLock.user !== currentUsername()) stopHeartbeat()
      return
    }
    lock.value = null
    stopHeartbeat()
    acquireOnOpen().catch(() => {})
  }

  return {
    lock,
    isHeldByMe,
    isLockedByOther,
    takeoverRequestedBy,
    acquireOnOpen,
    releaseOnClose,
    requestTakeover,
    releaseForOther,
    onTakeoverRequested,
    dismissTakeoverRequest,
    syncLockFromConflict,
    onLockStatusChanged,
  }
}

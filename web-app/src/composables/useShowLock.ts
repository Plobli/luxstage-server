import { ref, computed, watch } from 'vue'
import { acquireShowLock, releaseShowLock, releaseShowLockBeacon, ensureBeaconTokenReady, touchShowLock, requestLockTakeover, subscribeShow, type LockResult, type ShowPresenceUser } from '../api/shows.js'
import { ApiError } from '../api/client.js'
import { currentUsername } from '../api/currentUser.js'

export interface ShowLock {
  user: string;
  since: number;
}

const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000 // deutlich unter config.lockTimeout (10 Minuten)

/**
 * Verwaltet den Show-weiten Schreib-Lock im Frontend: Akquise beim Öffnen,
 * periodischer Heartbeat solange die Show offen ist, Freigabe beim Verlassen —
 * plus die SSE-Verbindung (Lock-Status/Übernahme-Anfragen/Präsenz), die diesen
 * Zustand aktuell hält. Beides war früher auf zwei Composables aufgeteilt
 * (useShowLock + useShowLockEvents), die sich gegenseitig brauchten: die
 * SSE-Events mussten an showLock weitergeleitet werden, showLock brauchte den
 * `lock`-Ref aus den SSE-Events. ShowDetailView.vue musste das per
 * Forward-Reference auflösen (Callbacks, die auf eine erst später erzeugte
 * showLock-Instanz zeigten). Zusammengeführt entfällt die Zirkularität: hier
 * gibt es nur noch einen einzigen Konstruktionsschritt.
 */
export function useShowLock(showId: string) {
  const lock = ref<ShowLock | null>(null)
  // Wer die Show gerade offen hat — der Server sendet die Liste bei jedem
  // Verbinden und Trennen. Rein informativ, unabhängig von der Schreibsperre.
  const presentUsers = ref<ShowPresenceUser[]>([])
  const takeoverRequestedBy = ref<string | null>(null)
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let unsubscribeSSE: (() => void) | null = null
  // Zusätzlich zu unsubscribeSSE(): ein bereits in der Event-Loop wartender
  // SSE-Callback (z.B. das eigene lock-status-updated, kurz bevor der Tab per
  // pagehide verschwindet) läuft trotz unsubscribe noch durch — dieses Flag
  // lässt onLockStatusChanged ihn dann ignorieren, statt fälschlich erneut
  // acquireOnOpen() für einen bereits verlassenen Tab auszulösen. Default true,
  // da onLockStatusChanged auch unabhängig von initLockEvents() aufrufbar
  // bleibt (siehe Tests) — nur cleanupLockEvents() schaltet gezielt ab.
  let active = true

  const isHeldByMe = computed(() => lock.value?.user === currentUsername())
  const isLockedByOther = computed(() => !!lock.value && !isHeldByMe.value)

  // Tab schließen/Reload/harte Navigation feuern kein onBeforeUnmount in Vue
  // und lassen einen normalen fetch()-Request oft unvollendet abbrechen — ohne
  // dies bliebe der Lock bis zum 10-Minuten-Timeout aktiv, obwohl niemand mehr
  // die Show offen hat (siehe releaseOnClose für den regulären Navigations-Fall).
  //
  // cleanupLockEvents() VOR dem Beacon: pagehide beendet den Tab nicht sofort
  // synchron — die SSE-Verbindung kann das eigene "lock-status-updated" (null)
  // noch empfangen, bevor die Seite wirklich weg ist. onLockStatusChanged()
  // greift dann automatisch wieder zu (das ist für den Fall gedacht, dass ein
  // ANDERER Tab den Lock freigibt), und derselbe sterbende Tab schnappt sich
  // den Lock, den er gerade selbst freigegeben hat — der Lock bleibt für immer
  // an diesem (verschwindenden) Tab hängen. Ohne aktive Subscription kann das
  // nicht mehr passieren.
  function onPageHide(): void {
    if (isHeldByMe.value) {
      cleanupLockEvents()
      releaseShowLockBeacon(showId)
    }
  }

  function startHeartbeat(): void {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (isHeldByMe.value) {
        touchShowLock(showId).catch(e => {
          // Bei 423 sofort wie bei einem Save-Konflikt behandeln, statt auf
          // die (evtl. gerade gestörte) SSE-Verbindung zu warten — sonst
          // glaubt dieser Tab weiter, den Lock zu halten, während der Server
          // längst ablehnt.
          if (e instanceof ApiError && e.status === 423) syncLockFromConflict(e.body ?? {})
        })
      }
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
      if (e instanceof ApiError && e.status === 423 && e.body?.lockedBy && e.body?.since) {
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
    if (!active) return
    if (newLock) {
      lock.value = newLock
      if (newLock.user !== currentUsername()) stopHeartbeat()
      return
    }
    lock.value = null
    stopHeartbeat()
    acquireOnOpen().catch(() => {})
  }

  /**
   * Richtet den Übernahme-Dialog ein: sobald ein anderer User die Show anfragt
   * (takeoverRequestedBy), wird über die übergebene confirm()-Funktion gefragt,
   * ob der Lock freigegeben werden soll. confirm/t sind UI-Composables der
   * aufrufenden View und werden bewusst injiziert statt hier importiert, damit
   * useShowLock frei von UI-Dialog-Abhängigkeiten bleibt.
   */
  function initTakeoverConfirm(
    confirmFn: (opts: Record<string, unknown>) => Promise<boolean>,
    t: (key: string, params?: Record<string, unknown>) => string,
  ): void {
    watch(takeoverRequestedBy, async (requestedBy) => {
      if (!requestedBy) return
      const release = await confirmFn({
        t,
        titleKey: 'lock.takeoverDialog.title',
        messageKey: 'lock.takeoverDialog.message',
        messageParams: { user: requestedBy },
        confirmKey: 'lock.takeoverDialog.release',
        cancelKey: 'lock.takeoverDialog.ignore',
      })
      if (release) await releaseForOther()
      else dismissTakeoverRequest()
    })
  }

  function initLockEvents(): void {
    active = true // falls zuvor cleanupLockEvents() lief (Re-Init nach Wieder-Öffnen)
    ensureBeaconTokenReady().catch(() => {})
    window.addEventListener('pagehide', onPageHide)
    unsubscribeSSE = subscribeShow(showId, {
      onLockStatus: onLockStatusChanged,
      onTakeoverRequested: onTakeoverRequested,
      // Der eigene Zugang zählt nicht als Mitleser — angezeigt werden nur andere.
      onPresence: ({ users }) => {
        const me = currentUsername()
        presentUsers.value = (users ?? []).filter(u => u.username !== me)
      },
    })
  }

  function cleanupLockEvents(): void {
    active = false
    window.removeEventListener('pagehide', onPageHide)
    unsubscribeSSE?.()
    presentUsers.value = []
  }

  return {
    lock,
    presentUsers,
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
    initLockEvents,
    initTakeoverConfirm,
    cleanupLockEvents,
  }
}

import { api } from './client'
import { invalidate } from './cache'

export interface ShowPresenceUser {
  username: string;
  /** Geräte desselben Nutzers, z.B. ['web', 'ios']. */
  devices: string[];
  lastActivityAt: string;
}

/**
 * SSE-Verbindung pro Show: Lock-Status/Übernahme-Anfragen (Single-Editor-Sperre)
 * und Präsenz (wer die Show gerade offen hat). Gibt eine Unsubscribe-Funktion zurück.
 * Nutzt pro Verbindungsversuch ein frisches kurzlebiges Einmal-Token (statt
 * des langlebigen JWT), damit kein Dauer-Token in Server-/Proxy-Logs landet.
 * EventSource kann bei einem Einmal-Token nicht selbst reconnecten (das Token
 * ist nach dem ersten Connect verbraucht) — der Reconnect wird daher hier
 * manuell mit neuem Token durchgeführt.
 *
 * Der Server sendet neun Event-Typen (Katalog in server/sse.js); hier werden bewusst nur
 * drei abgehört. Die sechs datenverändernden Events (channels-/sections-/towers-/bars-/
 * floorplan-/checks-updated) bleiben ungenutzt — sie sind für native Clients reserviert bzw.
 * Grundlage für ein späteres optimistischeres Update-Modell, kein totes Gepäck. Siehe
 * audits/architecture-analysis-2026-09-03.md, F-02.
 */
export function subscribeShow(showId: string, { onLockStatus, onTakeoverRequested, onPresence }: {
  onLockStatus?: (data: any) => void,
  onTakeoverRequested?: (data: any) => void,
  onPresence?: (data: { users: ShowPresenceUser[] }) => void,
} = {}): () => void {
  let es: EventSource | null = null
  let closed = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0

  // Exponentiell mit Obergrenze + Jitter statt fixem Delay — verhindert, dass
  // bei einem längeren Serverausfall (z.B. während des Selbst-Update-Neustarts)
  // jeder offene Tab jeder Show alle 3s unvermindert weiter reconnectet und den
  // gerade erst wieder hochgefahrenen Server zusätzlich belastet.
  function nextDelay(): number {
    const base = Math.min(3000 * 2 ** attempt, 30_000)
    return base / 2 + Math.random() * (base / 2)
  }

  async function connect(): Promise<void> {
    if (closed) return
    let url: string
    try {
      url = await api.downloadUrl(`/api/shows/${showId}/events?device=web`)
    } catch {
      if (!closed) { retryTimer = setTimeout(connect, nextDelay()); attempt++ }
      return
    }
    if (closed) return

    es = new EventSource(url)
    if (onLockStatus) es.addEventListener('lock-status-updated', (e: any) => onLockStatus(JSON.parse(e.data)))
    if (onTakeoverRequested) es.addEventListener('lock-takeover-requested', (e: any) => onTakeoverRequested(JSON.parse(e.data)))
    if (onPresence) es.addEventListener('presence-updated', (e: any) => onPresence(JSON.parse(e.data)))
    es.onopen = () => { attempt = 0 }
    es.onerror = () => {
      es?.close()
      es = null
      if (!closed) { retryTimer = setTimeout(connect, nextDelay()); attempt++ }
    }
  }

  connect()

  return () => {
    closed = true
    if (retryTimer) clearTimeout(retryTimer)
    es?.close()
  }
}

/**
 * Wickelt einen Aufruf, der die Show-Liste verändert, und verwirft danach den
 * Cache-Eintrag. Hier statt bei jedem Aufrufer: die Invalidierung gehört zur
 * Mutation selbst, sonst muss jede neue Aufrufstelle daran denken.
 */
function mutatesShows<A extends any[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    const result = await fn(...args)
    invalidate('shows')
    return result
  }
}

export const fetchShows         = (): Promise<any[]> => api.get('/api/shows')
export const fetchShow          = (id: string): Promise<any> => api.get(`/api/shows/${id}`)
export const createShow         = mutatesShows((data: any): Promise<any> => api.post('/api/shows', data))
export const updateMeta         = mutatesShows((id: string, fields: any): Promise<any> => api.put(`/api/shows/${id}/meta`, fields))
export const archiveShow         = mutatesShows((id: string): Promise<any> => api.delete(`/api/shows/${id}`))
export const deleteShowPermanent = mutatesShows((id: string): Promise<any> => api.delete(`/api/shows/${id}/permanent`))
export const fetchArchivedShows  = (): Promise<any[]> => api.get('/api/shows/archived')
export const restoreShow         = mutatesShows((id: string): Promise<any> => api.post(`/api/shows/${id}/restore`, {}))

export interface SaveToTemplateFields {
  channel?: boolean
  device?: boolean
  color?: boolean
  notes?: boolean
  position?: boolean
}

export function saveShowItemsToTemplate(
  showId: string,
  templateName: string,
  scope: 'bars' | 'towers',
  selectedIds: string[],
  fields: SaveToTemplateFields,
  overrideName?: string
): Promise<any> {
  return api.post(`/api/shows/${showId}/to-template`, { templateName, scope, selectedIds, fields, overrideName })
}

export function applyTemplateToShow(
  showId: string,
  templateName: string,
  scope: 'bars' | 'towers',
  withChannels: boolean,
  selectedIds: string[]
): Promise<any> {
  return api.post(`/api/shows/${showId}/from-template`, { templateName, scope, withChannels, selectedIds })
}

export function fetchHistory(showId: string): Promise<any[]> {
  return api.get(`/api/shows/${showId}/history`)
}

export function fetchHistoryEntry(showId: string, historyId: string): Promise<any> {
  return api.get(`/api/shows/${showId}/history/${historyId}`)
}

export function restoreHistory(showId: string, historyId: string): Promise<any> {
  return api.post(`/api/shows/${showId}/history/${historyId}/restore`, {})
}

export function createSnapshot(showId: string): Promise<any> {
  return api.post(`/api/shows/${showId}/history/snapshot`, {})
}

export interface LockResult {
  ok: boolean
  lockedBy?: string
  since?: number
}

export const acquireShowLock  = (showId: string): Promise<LockResult> => api.post(`/api/shows/${showId}/lock`, {})
export const releaseShowLock  = (showId: string, transferTo?: string): Promise<{ ok: true }> => api.delete(`/api/shows/${showId}/lock`, transferTo ? { transferTo } : undefined)
export const touchShowLock    = (showId: string): Promise<{ ok: true }> => api.put(`/api/shows/${showId}/lock`, {})
export const requestLockTakeover = (showId: string): Promise<{ ok: true, notified: string }> => api.post(`/api/shows/${showId}/lock/request-takeover`, {})

export const undoShow = (showId: string): Promise<{ ok: true }> => api.post(`/api/shows/${showId}/undo`, {})
export const redoShow = (showId: string): Promise<{ ok: true }> => api.post(`/api/shows/${showId}/redo`, {})


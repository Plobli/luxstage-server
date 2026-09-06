import { api } from './client'
import { invalidate } from './cache'

/** GET /api/shows / GET /api/shows/archived (server/routes/shows.js:42-50) —
 *  liefert die rohe `shows`-Zeile (SELECT *) mit `id` auf den Slug
 *  überschrieben, plus den aktuellen Lock. archived ist SQLite-typisch 0/1. */
export interface ShowSummary {
  id: string;
  slug: string;
  name: string;
  datum: string | null;
  template: string | null;
  spielzeit: string | null;
  use_bars: 0 | 1;
  use_towers: 0 | 1;
  archived: 0 | 1;
  created_at: number;
  updated_at: number;
  lock: LockInfo | null;
}

/** GET /api/shows/:id (server/routes/shows.js:244-265) — eigenes, von
 *  ShowSummary abweichendes Shape (camelCase-Felder, geparste EOS-Kanallisten,
 *  eingebettete Channels). */
export interface ShowDetail {
  id: string;
  name: string;
  datum: string | null;
  template: string | null;
  spielzeit: string | null;
  use_bars: boolean;
  use_towers: boolean;
  setupMarkdown: string;
  eosActiveChannels: string[] | null;
  eosExcludedChannels: string[] | null;
  channels: import('./channels').Channel[];
  lock: LockInfo | null;
}

export interface ShowPresenceUser {
  username: string;
  /** Geräte desselben Nutzers, z.B. ['web', 'ios']. */
  devices: string[];
  lastActivityAt: string;
}

/** getLock()-Rückgabe (server/db/locks.js), wie sie im SSE-Event landet. */
export interface LockInfo {
  user: string;
  since: number;
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
  onLockStatus?: (data: { lock: LockInfo | null }) => void,
  onTakeoverRequested?: (data: { requestedBy: string }) => void,
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
    if (onLockStatus) es.addEventListener('lock-status-updated', (e: MessageEvent<string>) => onLockStatus(JSON.parse(e.data)))
    if (onTakeoverRequested) es.addEventListener('lock-takeover-requested', (e: MessageEvent<string>) => onTakeoverRequested(JSON.parse(e.data)))
    if (onPresence) es.addEventListener('presence-updated', (e: MessageEvent<string>) => onPresence(JSON.parse(e.data)))
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
function mutatesShows<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    const result = await fn(...args)
    invalidate('shows')
    return result
  }
}

/** Eingabefelder für POST /api/shows (server/routes/shows.js:53-64). `id`
 *  wird dort als Slug verwendet (muss `/^[a-z0-9_-]+$/i` entsprechen). */
export interface ShowCreateInput {
  id: string;
  name?: string;
  datum?: string;
  template?: string | null;
  spielzeit?: string | null;
  channels?: import('./channels').Channel[];
  use_bars?: boolean;
  use_towers?: boolean;
  importSections?: boolean;
}

/** Teilmenge von Show-Feldern für PUT /api/shows/:id/meta (server/routes/shows.js:67-90). */
export interface ShowMetaFields {
  name?: string;
  datum?: string;
  template?: string | null;
  spielzeit?: string | null;
  setupMarkdown?: string;
  eosActiveChannels?: string;
  eosExcludedChannels?: string;
  use_bars?: boolean;
  use_towers?: boolean;
}

export const fetchShows         = (): Promise<ShowSummary[]> => api.get('/api/shows')
export const fetchShow          = (id: string): Promise<ShowDetail> => api.get(`/api/shows/${id}`)
export const createShow         = mutatesShows((data: ShowCreateInput): Promise<{ id: string }> => api.post('/api/shows', data))
export const updateMeta         = mutatesShows((id: string, fields: ShowMetaFields): Promise<{ ok: true }> => api.put(`/api/shows/${id}/meta`, fields))
export const archiveShow         = mutatesShows((id: string): Promise<{ ok: true }> => api.delete(`/api/shows/${id}`))
export const deleteShowPermanent = mutatesShows((id: string): Promise<{ ok: true }> => api.delete(`/api/shows/${id}/permanent`))
export const fetchArchivedShows  = (): Promise<ShowSummary[]> => api.get('/api/shows/archived')
export const restoreShow         = mutatesShows((id: string): Promise<{ ok: true }> => api.post(`/api/shows/${id}/restore`, {}))

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
): Promise<{ ok: true }> {
  return api.post(`/api/shows/${showId}/to-template`, { templateName, scope, selectedIds, fields, overrideName })
}

export function applyTemplateToShow(
  showId: string,
  templateName: string,
  scope: 'bars' | 'towers',
  withChannels: boolean,
  selectedIds: string[]
): Promise<{ ok: true }> {
  return api.post(`/api/shows/${showId}/from-template`, { templateName, scope, withChannels, selectedIds })
}

/** Listeneintrag von GET /api/shows/:id/history (server/history.js listHistory()). */
export interface HistoryListEntry {
  id: string;
  created_at: number;
}

/** GET /api/shows/:id/history/:historyId (server/routes/history.js) — channels/
 *  sections werden dort serverseitig aus dem gespeicherten JSON geparst. */
export interface HistoryEntry {
  id: string;
  created_at: number;
  channels: import('./channels').Channel[];
  sections: unknown[];
}

export function fetchHistory(showId: string): Promise<HistoryListEntry[]> {
  return api.get(`/api/shows/${showId}/history`)
}

export function fetchHistoryEntry(showId: string, historyId: string): Promise<HistoryEntry> {
  return api.get(`/api/shows/${showId}/history/${historyId}`)
}

export function restoreHistory(showId: string, historyId: string): Promise<{ ok: true }> {
  return api.post(`/api/shows/${showId}/history/${historyId}/restore`, {})
}

export function createSnapshot(showId: string): Promise<{ ok: true }> {
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


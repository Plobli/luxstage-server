import { api } from './client'
import { invalidate } from './cache'

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


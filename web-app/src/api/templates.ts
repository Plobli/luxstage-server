import { api } from './client'
import { type Channel } from './channels'

export interface TemplateMeta {
  name: string
  oscHost: string
  channelCount: number
  updatedAt: number | null
}

export const fetchTemplates = (): Promise<TemplateMeta[]> => api.get('/api/templates')
export const deleteTemplate = (name: string): Promise<any> => api.delete(`/api/templates/${name}`)
export const saveTemplateOscHost = (name: string, oscHost: string): Promise<any> =>
  api.put('/api/templates', { name, oscHost })

export const renameTemplate = (name: string, newName: string): Promise<{ ok: boolean, name: string }> =>
  api.patch(`/api/templates/${encodeURIComponent(name)}`, { name: newName })

export async function fetchTemplateChannels(name: string): Promise<Channel[]> {
  return api.get(`/api/templates/${encodeURIComponent(name)}/channels`)
}

export async function fetchTemplatePdfUrl(name: string): Promise<string> {
  return api.downloadUrl(`/api/templates/${encodeURIComponent(name)}/pdf`)
}

export async function saveTemplate(name: string, channels: Channel[]): Promise<any> {
  return api.put(`/api/templates/${encodeURIComponent(name)}`, channels)
}

export async function applyTemplateToAllShows(name: string, scope: 'bars' | 'sections'): Promise<{ ok: boolean, shows: number, barsAdded: number, sectionsAdded: number }> {
  return api.post(`/api/templates/${encodeURIComponent(name)}/apply-to-shows`, { scope })
}

export async function uploadTemplate({ name, text }: { name: string, text: string }): Promise<any> {
  // CSV-Text von Datei-Upload: parsen und als Array senden
  const cleanName = name.replace(/\.csv$/i, '')
  const lines = text.trim().split('\n').filter(Boolean)
  const headerIdx = lines.findIndex(l => l.startsWith('channel'))
  if (headerIdx === -1) return
  const headers = lines[headerIdx].split(';').map(h => h.trim())
  const channels = lines.slice(headerIdx + 1).map(line => {
    const vals = line.split(';')
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
  return api.put(`/api/templates/${encodeURIComponent(cleanName)}`, channels)
}

export interface TemplateLockResult { ok: boolean, lockedBy?: string, since?: number }
export const acquireTemplateLock = (name: string): Promise<TemplateLockResult> => api.post(`/api/templates/${encodeURIComponent(name)}/lock`, {})
export const releaseTemplateLock = (name: string): Promise<{ ok: true }> => api.delete(`/api/templates/${encodeURIComponent(name)}/lock`)
export const touchTemplateLock = (name: string): Promise<{ ok: true }> => api.put(`/api/templates/${encodeURIComponent(name)}/lock`, {})


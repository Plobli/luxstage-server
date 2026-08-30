import { api, getToken, BASE } from './client'

export interface Channel {
  channel: string;
  address?: string;
  device?: string;
  position?: string;
  color?: string;
  notes?: string;
  [key: string]: any;
}

export async function fetchChannels(showId: string): Promise<Channel[]> {
  return api.get<Channel[]>(`/api/shows/${showId}/channels`)
}

/** Häufigkeit verwendeter Farbcodes über alle Shows hinweg, absteigend sortiert. */
export async function fetchColorUsage(): Promise<{ color: string, count: number }[]> {
  return api.get<{ color: string, count: number }[]>('/api/channels/color-usage')
}

export async function saveChannels(showId: string, channels: Channel[]): Promise<void> {
  await api.put(`/api/shows/${showId}/channels`, channels)
}

export interface CircuitScanResult {
  rows: Channel[]
}

/** Lädt ein Foto des ausgefüllten Kreislisten-Vordrucks hoch und lässt es per
 *  Claude Vision auswerten. Schreibt nichts in die Show — liefert nur den
 *  Vorschlag zur Vorschau/Bestätigung durch den Nutzer. */
export function scanCircuitSheet(showId: string, file: File): Promise<CircuitScanResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/shows/${showId}/circuit-scan`)
    xhr.setRequestHeader('Authorization', 'Bearer ' + (getToken() || ''))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else reject(new Error(JSON.parse(xhr.responseText || '{}')?.error || `Scan fehlgeschlagen: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Netzwerkfehler'))
    const formData = new FormData()
    formData.append('photo', file, file.name)
    xhr.send(formData)
  })
}

export function parseChannelsCsv(text: string): Channel[] {
  const lines = text.split('\n').filter(Boolean)
  if (lines.length <= 1) return []
  const headers = ['channel', 'address', 'device', 'position', 'color', 'notes']
  return lines.slice(1).map(line => {
    const parts = line.split(';')
    return Object.fromEntries(headers.map((h, i) => [h, (parts[i] ?? '').trim()]))
  }).filter(ch => ch.channel !== '') as Channel[]
}

export function mergeChannels(existing: Channel[], imported: Channel[]): Channel[] {
  const result = existing.map(ch => {
    const match = imported.find(i => i.channel === ch.channel)
    if (!match) return ch
    return { ...ch, ...Object.fromEntries(Object.entries(match).filter(([, v]) => v !== '')) }
  })
  for (const imp of imported) {
    if (!result.find(ch => ch.channel === imp.channel)) {
      result.push(imp)
    }
  }
  result.sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
  return result
}

export function downloadChannelsCsv(showId: string, channels: Channel[]): void {
  const headers = ['channel', 'address', 'device', 'position', 'color', 'notes']
  const rows = [headers.join(';')]
  for (const ch of channels) rows.push(headers.map(h => ch[h] ?? '').join(';'))
  const csv = rows.join('\n') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${showId}-kanäle.csv`
  a.click()
  URL.revokeObjectURL(url)
}


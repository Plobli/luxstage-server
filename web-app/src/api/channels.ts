import { api } from './client'

export interface Channel {
  channel: string;
  address?: string;
  device?: string;
  position?: string;
  color?: string;
  notes?: string;
  [key: string]: any;
}

export interface ChannelsConflictError {
  serverVersion: string;
  serverChannels: Channel[];
}

export async function fetchChannels(showId: string): Promise<{ channels: Channel[], version: string | null }> {
  const { data, headers } = await api.getWithHeaders<Channel[]>(`/api/shows/${showId}/channels`)
  return { channels: data, version: headers.get('X-Show-Version') }
}

/** Wirft ApiError mit status 409 und body {serverVersion, serverChannels}, falls
 *  baseVersion nicht mehr dem Serverstand entspricht (jemand anders hat
 *  inzwischen gespeichert). baseVersion === null überspringt die Prüfung
 *  (z.B. beim allerersten Save nach dem Laden, falls keine Version vorliegt). */
export async function saveChannels(showId: string, channels: Channel[], baseVersion: string | null = null): Promise<{ version: string | null }> {
  const { version } = await api.putWithVersion<{ ok: true }>(`/api/shows/${showId}/channels`, channels, baseVersion)
  return { version }
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


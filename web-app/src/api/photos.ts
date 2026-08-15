/**
 * photos.ts — Foto-API v1.1
 * Komprimierung passiert server-seitig (sharp) — kein Canvas mehr nötig.
 */
import { api, getToken, BASE } from './client'

export async function fetchPhotos(showId: string): Promise<any[]> {
  return api.get(`/api/shows/${showId}/photos`)
}

export function uploadPhoto(showId: string, file: File, onProgress?: (p: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/shows/${showId}/photos`)
    xhr.setRequestHeader('Authorization', 'Bearer ' + (getToken() || ''))
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else reject(new Error(`Upload fehlgeschlagen: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Netzwerkfehler'))
    const formData = new FormData()
    formData.append('photo', file, file.name)
    xhr.send(formData)
  })
}

export async function deletePhoto(showId: string, filename: string): Promise<any> {
  return api.delete(`/api/shows/${showId}/photos/${filename}`)
}

export async function fetchPhotoCaptions(showId: string): Promise<any> {
  return api.get(`/api/shows/${showId}/photo-captions`)
}

export async function savePhotoCaption(showId: string, filename: string, caption: string, channelNumber: string | number = ''): Promise<any> {
  return api.put(`/api/shows/${showId}/photo-captions/${encodeURIComponent(filename)}`, { caption, channelNumber })
}

export async function getPhotoUrl(showId: string, filename: string, { thumb = false } = {}): Promise<string> {
  const url = await api.url(`/api/shows/${showId}/photos/${filename}`)
  return thumb ? url + '&thumb=1' : url
}

// ── Channel Photos ──────────────────────────────────────────────────────

export async function fetchChannelPhotos(showId: string, channelId: string): Promise<any[]> {
  return api.get(`/api/shows/${showId}/channels/${channelId}/photos`)
}

export async function addChannelPhoto(showId: string, channelId: string, filename: string): Promise<any> {
  return api.post(`/api/shows/${showId}/channels/${channelId}/photos`, { filename })
}

export async function removeChannelPhoto(showId: string, channelId: string, filename: string): Promise<any> {
  return api.delete(`/api/shows/${showId}/channels/${channelId}/photos/${encodeURIComponent(filename)}`)
}

export async function reorderChannelPhotos(showId: string, channelId: string, filenames: string[]): Promise<any> {
  return api.put(`/api/shows/${showId}/channels/${channelId}/photos/reorder`, { photos: filenames })
}


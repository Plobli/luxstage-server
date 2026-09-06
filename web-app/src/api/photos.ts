/**
 * photos.ts — Foto-API v1.1
 * Komprimierung passiert server-seitig (sharp) — kein Canvas mehr nötig.
 */
import { api, getToken, BASE } from './client'

export async function fetchPhotos(showId: string): Promise<string[]> {
  return api.get(`/api/shows/${showId}/photos`)
}

export interface PhotoUploadResult {
  saved: string[];
}

export function uploadPhoto(showId: string, file: File, onProgress?: (p: number) => void): Promise<PhotoUploadResult> {
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

export async function deletePhoto(showId: string, filename: string): Promise<{ ok: true }> {
  return api.delete(`/api/shows/${showId}/photos/${filename}`)
}

/** GET .../photo-captions (server/db/photos.js readPhotoDescriptions()) —
 *  Map von Dateiname auf Beschriftung. */
export type PhotoCaptions = Record<string, { caption: string }>

export async function fetchPhotoCaptions(showId: string): Promise<PhotoCaptions> {
  return api.get(`/api/shows/${showId}/photo-captions`)
}

export async function savePhotoCaption(showId: string, filename: string, caption: string): Promise<{ ok: true }> {
  return api.put(`/api/shows/${showId}/photo-captions/${encodeURIComponent(filename)}`, { caption })
}

export async function fetchAllPhotoChannels(showId: string): Promise<Record<string, string[]>> {
  return api.get(`/api/shows/${showId}/photo-channels`)
}

export async function savePhotoChannels(showId: string, filename: string, channelIds: string[]): Promise<{ ok: true }> {
  return api.put(`/api/shows/${showId}/photos/${encodeURIComponent(filename)}/channels`, { channelIds })
}

export async function getPhotoUrl(showId: string, filename: string, { thumb = false } = {}): Promise<string> {
  const url = await api.url(`/api/shows/${showId}/photos/${filename}`)
  return thumb ? url + '&thumb=1' : url
}


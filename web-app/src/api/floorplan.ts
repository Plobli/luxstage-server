// LuxStage/web-app/src/api/floorplan.ts
import { api, BASE, getToken } from './client'

/** GET .../floorplan (server/routes/floorplan.js, template-floorplan.js) —
 *  canvas_data ist ein bereits serialisierter JSON-String (Fabric.js-Canvas). */
export interface FloorplanData {
  image_url: string | null;
  canvas_data: string | null;
}

export interface FloorplanImageUploadResult {
  image_url: string;
}

export function fetchTemplateFloorplan(templateId: string): Promise<FloorplanData> {
  return api.get(`/api/templates/${templateId}/floorplan`)
}

export function saveTemplateFloorplan(templateId: string, canvasData: string): Promise<{ ok: true }> {
  return api.put(`/api/templates/${templateId}/floorplan`, { canvas_data: canvasData })
}

export function deleteTemplateFloorplanImage(templateId: string): Promise<{ ok: true }> {
  return api.delete(`/api/templates/${templateId}/floorplan/image`)
}

export function uploadTemplateFloorplanImage(templateId: string, file: File): Promise<FloorplanImageUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/templates/${templateId}/floorplan/image`)
    xhr.setRequestHeader('Authorization', 'Bearer ' + (getToken() || ''))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else {
        let msg = `Upload fehlgeschlagen: ${xhr.status}`
        try { msg += ' — ' + JSON.parse(xhr.responseText).error } catch {}
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Netzwerkfehler'))
    const formData = new FormData()
    formData.append('image', file, file.name)
    xhr.send(formData)
  })
}

export function uploadShowFloorplanImage(showId: string, file: File): Promise<FloorplanImageUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/shows/${showId}/floorplan/image`)
    xhr.setRequestHeader('Authorization', 'Bearer ' + (getToken() || ''))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else {
        let msg = `Upload fehlgeschlagen: ${xhr.status}`
        try { msg += ' — ' + JSON.parse(xhr.responseText).error } catch {}
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Netzwerkfehler'))
    const formData = new FormData()
    formData.append('image', file, file.name)
    xhr.send(formData)
  })
}

export function deleteShowFloorplanImage(showId: string): Promise<{ ok: true }> {
  return api.delete(`/api/shows/${showId}/floorplan/image`)
}

export function fetchShowFloorplan(showId: string): Promise<FloorplanData> {
  return api.get(`/api/shows/${showId}/floorplan`)
}

export function saveShowFloorplan(showId: string, canvasData: string): Promise<{ ok: true }> {
  return api.put(`/api/shows/${showId}/floorplan`, { canvas_data: canvasData })
}


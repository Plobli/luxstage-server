// LuxStage/web-app/src/api/floorplan.ts
import { api, BASE, getToken } from './client'

export function fetchTemplateFloorplan(templateId: string): Promise<any> {
  return api.get(`/api/templates/${templateId}/floorplan`)
}

export function saveTemplateFloorplan(templateId: string, canvasData: any): Promise<any> {
  return api.put(`/api/templates/${templateId}/floorplan`, { canvas_data: canvasData })
}

export function deleteTemplateFloorplanImage(templateId: string): Promise<any> {
  return api.delete(`/api/templates/${templateId}/floorplan/image`)
}

export function uploadTemplateFloorplanImage(templateId: string, file: File): Promise<any> {
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

export function uploadShowFloorplanImage(showId: string, file: File): Promise<any> {
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

export function deleteShowFloorplanImage(showId: string): Promise<any> {
  return api.delete(`/api/shows/${showId}/floorplan/image`)
}

export function fetchShowFloorplan(showId: string): Promise<any> {
  return api.get(`/api/shows/${showId}/floorplan`)
}

export function saveShowFloorplan(showId: string, canvasData: any): Promise<any> {
  return api.put(`/api/shows/${showId}/floorplan`, { canvas_data: canvasData })
}


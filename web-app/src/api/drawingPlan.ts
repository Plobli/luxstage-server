// LuxStage/web-app/src/api/drawingPlan.ts
import { api, BASE, getToken } from './client'

/** GET .../drawingPlan (server/routes/drawing-plan.js, template-drawing-plan.js) —
 *  canvas_data ist ein bereits serialisierter JSON-String (Fabric.js-Canvas). */
export interface DrawingPlanData {
  image_url: string | null;
  canvas_data: string | null;
}

export interface DrawingPlanImageUploadResult {
  image_url: string;
}

export function fetchTemplateDrawingPlan(templateId: string): Promise<DrawingPlanData> {
  return api.get(`/api/templates/${templateId}/drawing-plan`)
}

export function saveTemplateDrawingPlan(templateId: string, canvasData: string): Promise<{ ok: true }> {
  return api.put(`/api/templates/${templateId}/drawing-plan`, { canvas_data: canvasData })
}

export function deleteTemplateDrawingPlanImage(templateId: string): Promise<{ ok: true }> {
  return api.delete(`/api/templates/${templateId}/drawing-plan/image`)
}

export function uploadTemplateDrawingPlanImage(templateId: string, file: File): Promise<DrawingPlanImageUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/templates/${templateId}/drawing-plan/image`)
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

export function uploadShowDrawingPlanImage(showId: string, file: File): Promise<DrawingPlanImageUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE()}/api/shows/${showId}/drawing-plan/image`)
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

export function deleteShowDrawingPlanImage(showId: string): Promise<{ ok: true }> {
  return api.delete(`/api/shows/${showId}/drawing-plan/image`)
}

export function fetchShowDrawingPlan(showId: string): Promise<DrawingPlanData> {
  return api.get(`/api/shows/${showId}/drawing-plan`)
}

export function saveShowDrawingPlan(showId: string, canvasData: string): Promise<{ ok: true }> {
  return api.put(`/api/shows/${showId}/drawing-plan`, { canvas_data: canvasData })
}


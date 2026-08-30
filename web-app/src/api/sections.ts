import { api } from './client'

export const fetchTemplateSections = (name: string): Promise<any> =>
  api.get(`/api/templates/${encodeURIComponent(name)}/sections`)

export const saveTemplateSections = (name: string, sections: any[]): Promise<any> =>
  api.put(`/api/templates/${encodeURIComponent(name)}/sections`, { sections })

export async function fetchShowSections(id: string): Promise<any[]> {
  return api.get<any[]>(`/api/shows/${id}/sections`)  // returns [{ id, content }]
}

export async function saveShowSections(id: string, sections: any[]): Promise<void> {
  await api.put(`/api/shows/${id}/sections`, sections)  // sends [{ id, content }]
}

export async function fetchShowSectionDefs(id: string): Promise<any[]> {
  return api.get<any[]>(`/api/shows/${id}/section-defs`)
}

export async function saveShowSectionDefs(id: string, sections: any[]): Promise<void> {
  await api.put(`/api/shows/${id}/section-defs`, { sections })
}


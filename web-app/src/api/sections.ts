import { api } from './client'

export const fetchTemplateSections = (name: string): Promise<any> =>
  api.get(`/api/templates/${encodeURIComponent(name)}/sections`)

export const saveTemplateSections = (name: string, sections: any[]): Promise<any> =>
  api.put(`/api/templates/${encodeURIComponent(name)}/sections`, { sections })

export async function fetchShowSections(id: string): Promise<{ sections: any[], version: string | null }> {
  const { data, headers } = await api.getWithHeaders<any[]>(`/api/shows/${id}/sections`)  // returns [{ id, content }]
  return { sections: data, version: headers.get('X-Show-Version') }
}

/** Wirft ApiError mit status 409 und body {serverVersion, serverSections}, falls
 *  baseVersion nicht mehr dem Serverstand entspricht. */
export async function saveShowSections(id: string, sections: any[], baseVersion: string | null = null): Promise<{ version: string | null }> {
  const { version } = await api.putWithVersion<{ ok: true }>(`/api/shows/${id}/sections`, sections, baseVersion)  // sends [{ id, content }]
  return { version }
}

export async function fetchShowSectionDefs(id: string): Promise<{ defs: any[], version: string | null }> {
  const { data, headers } = await api.getWithHeaders<any[]>(`/api/shows/${id}/section-defs`)
  return { defs: data, version: headers.get('X-Show-Version') }
}

export async function saveShowSectionDefs(id: string, sections: any[], baseVersion: string | null = null): Promise<{ version: string | null }> {
  const { version } = await api.putWithVersion<{ ok: true }>(`/api/shows/${id}/section-defs`, { sections }, baseVersion)
  return { version }
}


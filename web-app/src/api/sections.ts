import { api } from './client'

/** Inhalt einer einzelnen Show-Sektion (server/routes/sections.js:19). */
export interface SectionContent {
  id: string;
  content: string;
}

/** section_defs-Zeile mit ihren Kind-Zeilen (server/db/section-defs-core.js
 *  readSectionDefsCore()) — je nach `type` entweder `rows` (Key/Value-Tabelle)
 *  oder `fields` (Formularfelder), nie beide. */
export interface SectionKvRow {
  id: string;
  label: string;
  value: string;
  sort_order: number;
}

export interface SectionField {
  id: string;
  key: string;
  label: string;
  unit: string;
}

export interface SectionDef {
  id: string;
  title: string;
  type: string;
  icon: string;
  order: number;
  rows?: SectionKvRow[];
  fields?: SectionField[];
}

export const fetchTemplateSections = (name: string): Promise<SectionDef[]> =>
  api.get(`/api/templates/${encodeURIComponent(name)}/sections`)

export const saveTemplateSections = (name: string, sections: SectionDef[]): Promise<{ ok: true }> =>
  api.put(`/api/templates/${encodeURIComponent(name)}/sections`, { sections })

export async function fetchShowSections(id: string): Promise<SectionContent[]> {
  return api.get<SectionContent[]>(`/api/shows/${id}/sections`)
}

export async function saveShowSections(id: string, sections: SectionContent[]): Promise<void> {
  await api.put(`/api/shows/${id}/sections`, sections)
}

export async function fetchShowSectionDefs(id: string): Promise<SectionDef[]> {
  return api.get<SectionDef[]>(`/api/shows/${id}/section-defs`)
}

export async function saveShowSectionDefs(id: string, sections: SectionDef[]): Promise<void> {
  await api.put(`/api/shows/${id}/section-defs`, { sections })
}


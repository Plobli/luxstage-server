import { api } from './client'
import type { BarType } from './bars'

export interface TemplateBar {
  id: string
  template_id: string
  name: string
  zug_nr: string
  length_cm: number
  sort_order: number
  bar_type: BarType
}

export async function fetchTemplateBars(templateName: string): Promise<TemplateBar[]> {
  return api.get(`/api/templates/${encodeURIComponent(templateName)}/bars`)
}

export async function createTemplateBar(templateName: string, data: Partial<TemplateBar>): Promise<{ id: string }> {
  return api.post(`/api/templates/${encodeURIComponent(templateName)}/bars`, data)
}

export async function updateTemplateBar(templateName: string, barId: string, data: Partial<TemplateBar>): Promise<void> {
  return api.put(`/api/templates/${encodeURIComponent(templateName)}/bars/${barId}`, data)
}

export async function deleteTemplateBar(templateName: string, barId: string): Promise<void> {
  return api.delete(`/api/templates/${encodeURIComponent(templateName)}/bars/${barId}`)
}

export async function reorderTemplateBars(templateName: string, order: string[]): Promise<void> {
  return api.put(`/api/templates/${encodeURIComponent(templateName)}/bars/reorder`, { order })
}

export interface TemplateBarFixture {
  id: string
  bar_id: string
  position: number
  channel: string | null
  device: string | null
  color: string | null
  notes: string
}

export async function fetchTemplateBarFixtures(templateName: string, barId: string): Promise<TemplateBarFixture[]> {
  return api.get(`/api/templates/${encodeURIComponent(templateName)}/bars/${barId}/fixtures`)
}

export async function createTemplateBarFixture(templateName: string, barId: string, data: Partial<TemplateBarFixture>): Promise<{ id: string }> {
  return api.post(`/api/templates/${encodeURIComponent(templateName)}/bars/${barId}/fixtures`, data)
}

export async function updateTemplateBarFixture(templateName: string, barId: string, fixtureId: string, data: Partial<TemplateBarFixture>): Promise<void> {
  return api.put(`/api/templates/${encodeURIComponent(templateName)}/bars/${barId}/fixtures/${fixtureId}`, data)
}

export async function deleteTemplateBarFixture(templateName: string, barId: string, fixtureId: string): Promise<void> {
  return api.delete(`/api/templates/${encodeURIComponent(templateName)}/bars/${barId}/fixtures/${fixtureId}`)
}

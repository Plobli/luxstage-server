import { api } from './client'
import type { BattenType } from './battens'

export interface TemplateBatten {
  id: string
  template_id: string
  name: string
  batten_nr: string
  length_cm: number
  sort_order: number
  batten_type: BattenType
}

export async function fetchTemplateBattens(templateName: string): Promise<TemplateBatten[]> {
  return api.get(`/api/templates/${encodeURIComponent(templateName)}/battens`)
}

export async function createTemplateBatten(templateName: string, data: Partial<TemplateBatten>): Promise<{ id: string }> {
  return api.post(`/api/templates/${encodeURIComponent(templateName)}/battens`, data)
}

export async function updateTemplateBatten(templateName: string, battenId: string, data: Partial<TemplateBatten>): Promise<void> {
  return api.put(`/api/templates/${encodeURIComponent(templateName)}/battens/${battenId}`, data)
}

export async function deleteTemplateBatten(templateName: string, battenId: string): Promise<void> {
  return api.delete(`/api/templates/${encodeURIComponent(templateName)}/battens/${battenId}`)
}

export async function reorderTemplateBattens(templateName: string, order: string[]): Promise<void> {
  return api.put(`/api/templates/${encodeURIComponent(templateName)}/battens/reorder`, { order })
}

export interface TemplateBattenFixture {
  id: string
  batten_id: string
  position: number
  channel: string | null
  device: string | null
  color: string | null
  notes: string
}

export async function fetchTemplateBattenFixtures(templateName: string, battenId: string): Promise<TemplateBattenFixture[]> {
  return api.get(`/api/templates/${encodeURIComponent(templateName)}/battens/${battenId}/fixtures`)
}

export async function createTemplateBattenFixture(templateName: string, battenId: string, data: Partial<TemplateBattenFixture>): Promise<{ id: string }> {
  return api.post(`/api/templates/${encodeURIComponent(templateName)}/battens/${battenId}/fixtures`, data)
}

export async function updateTemplateBattenFixture(templateName: string, battenId: string, fixtureId: string, data: Partial<TemplateBattenFixture>): Promise<void> {
  return api.put(`/api/templates/${encodeURIComponent(templateName)}/battens/${battenId}/fixtures/${fixtureId}`, data)
}

export async function deleteTemplateBattenFixture(templateName: string, battenId: string, fixtureId: string): Promise<void> {
  return api.delete(`/api/templates/${encodeURIComponent(templateName)}/battens/${battenId}/fixtures/${fixtureId}`)
}

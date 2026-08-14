import { api } from './client'

export type BarType = 'zugstange' | 'traverse' | 'punktzug'

export interface BarFixture {
  id: string
  bar_id: string
  channel_id: string
  position: number
  notes?: string
}

export interface Bar {
  id: string
  show_id: string
  name: string
  zug_nr: string
  length_cm: number
  sort_order: number
  fixtures: BarFixture[]
  height_cm?: number | null
  notes?: string | null
  bar_type: BarType
}

export async function fetchBars(showId: string): Promise<Bar[]> {
  return api.get(`/api/shows/${showId}/bars`)
}

export async function createBar(showId: string, data: Partial<Bar>): Promise<{ id: string }> {
  return api.post(`/api/shows/${showId}/bars`, data)
}

export async function updateBar(showId: string, barId: string, data: Partial<Bar>): Promise<void> {
  return api.put(`/api/shows/${showId}/bars/${barId}`, data)
}

export async function deleteBar(showId: string, barId: string): Promise<void> {
  return api.delete(`/api/shows/${showId}/bars/${barId}`)
}

export async function addBarFixture(showId: string, barId: string, channelId: string, position: number, notes?: string, fixtureId?: string): Promise<{ id: string }> {
  return api.post(`/api/shows/${showId}/bars/${barId}/fixtures`, { channelId, position, notes: notes ?? '', fixtureId: fixtureId ?? null })
}

export async function patchBarFixtureNotes(showId: string, barId: string, fixtureId: string, notes: string): Promise<void> {
  return api.patch(`/api/shows/${showId}/bars/${barId}/fixtures/${fixtureId}`, { notes })
}

export async function removeBarFixture(showId: string, barId: string, fixtureId: string): Promise<void> {
  return api.delete(`/api/shows/${showId}/bars/${barId}/fixtures/${fixtureId}`)
}

export async function reorderBars(showId: string, order: string[]): Promise<void> {
  return api.put(`/api/shows/${showId}/bars/reorder`, { order })
}

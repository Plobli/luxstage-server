import { api } from './client'

export type BattenType = 'batten' | 'traverse' | 'point_batten'
export type FixtureSide = 'in' | 'out'

export interface BattenFixture {
  id: string
  batten_id: string
  channel_id: string | null
  position: number
  notes?: string
  side?: FixtureSide
  position_text?: string
  label?: string
}

export interface Batten {
  id: string
  show_id: string
  name: string
  batten_nr: string
  length_cm: number
  sort_order: number
  fixtures: BattenFixture[]
  height_cm?: number | null
  notes?: string | null
  batten_type: BattenType
}

export async function fetchBattens(showId: string): Promise<Batten[]> {
  return api.get(`/api/shows/${showId}/battens`)
}

export async function createBatten(showId: string, data: Partial<Batten>): Promise<{ id: string }> {
  return api.post(`/api/shows/${showId}/battens`, data)
}

export async function updateBatten(showId: string, battenId: string, data: Partial<Batten>): Promise<void> {
  return api.put(`/api/shows/${showId}/battens/${battenId}`, data)
}

export async function deleteBatten(showId: string, battenId: string): Promise<void> {
  return api.delete(`/api/shows/${showId}/battens/${battenId}`)
}

export async function deleteAllBattens(showId: string): Promise<void> {
  return api.delete(`/api/shows/${showId}/battens`)
}

export interface AddBattenFixtureOptions {
  channelId?: string | null
  label?: string
  notes?: string
  fixtureId?: string
  side?: FixtureSide
  positionText?: string
}

export async function addBattenFixture(showId: string, battenId: string, position: number, opts: AddBattenFixtureOptions = {}): Promise<{ id: string }> {
  const { channelId, label, notes, fixtureId, side, positionText } = opts
  return api.post(`/api/shows/${showId}/battens/${battenId}/fixtures`, { channelId: channelId ?? null, label: label ?? '', position, notes: notes ?? '', fixtureId: fixtureId ?? null, side: side ?? 'out', positionText: positionText ?? '' })
}

export async function patchBattenFixtureNotes(showId: string, battenId: string, fixtureId: string, notes: string): Promise<void> {
  return api.patch(`/api/shows/${showId}/battens/${battenId}/fixtures/${fixtureId}`, { notes })
}

export async function removeBattenFixture(showId: string, battenId: string, fixtureId: string): Promise<void> {
  return api.delete(`/api/shows/${showId}/battens/${battenId}/fixtures/${fixtureId}`)
}

export async function reorderBattens(showId: string, order: string[]): Promise<void> {
  return api.put(`/api/shows/${showId}/battens/reorder`, { order })
}

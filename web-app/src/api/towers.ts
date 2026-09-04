import { api } from './client'

export interface TowerSlot {
  id: string
  tower_id: string
  slot_index: number
  channel_id: string | null
}

export interface Tower {
  id: string
  show_id: string
  name: string
  side: string
  stage_area: string
  slot_count: number
  sort_order: number
  notes: string
  slots: TowerSlot[]
}

export async function fetchTowers(showId: string): Promise<Tower[]> {
  return api.get(`/api/shows/${showId}/towers`)
}

export async function createTower(showId: string, data: Partial<Tower>): Promise<{ id: string }> {
  return api.post(`/api/shows/${showId}/towers`, data)
}

export async function updateTower(showId: string, towerId: string, data: Partial<Tower>): Promise<void> {
  return api.put(`/api/shows/${showId}/towers/${towerId}`, data)
}

export async function deleteTower(showId: string, towerId: string): Promise<void> {
  return api.delete(`/api/shows/${showId}/towers/${towerId}`)
}

export async function assignTowerSlot(showId: string, towerId: string, slotIndex: number, channelId: string | null): Promise<void> {
  return api.patch(`/api/shows/${showId}/towers/${towerId}/slots/${slotIndex}`, { channelId })
}

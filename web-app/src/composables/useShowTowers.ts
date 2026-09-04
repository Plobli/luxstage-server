import { ref, type Ref } from 'vue'
import { fetchTowers, createTower, updateTower, deleteTower as apiDeleteTower, assignTowerSlot, type Tower } from '../api/towers'
import type { Channel } from '../api/channels'
import { withLockConflict } from './withLockConflict'

// channels.mount_ref (Rückverweis Kanal -> Turm/Slot) wird ausschließlich
// serverseitig gepflegt (siehe server/db/towers.js writeTowerSlot/clearTowerSlot/
// restoreTowers) — reloadChannels() holt nach jeder Slot-Änderung den
// aktuellen Stand, statt ihn hier im Client redundant nachzubilden.
export function useShowTowers(showId: string, channels?: Ref<Channel[]>, externalTowers?: Ref<Tower[]>, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void, reloadChannels?: () => Promise<void>) {
  const towers = externalTowers ?? ref<Tower[]>([])
  const loading = ref(false)

  async function loadTowers() {
    loading.value = true
    try {
      towers.value = await fetchTowers(showId)
    } finally {
      loading.value = false
    }
  }

  const addTower = withLockConflict(onLockConflict, async (data: Partial<Tower>) => {
    const { id } = await createTower(showId, data)
    await loadTowers()
    return id
  })

  const saveTower = withLockConflict(onLockConflict, async (towerId: string, data: Partial<Tower>) => {
    await updateTower(showId, towerId, data)
    await loadTowers()
  })

  const removeTower = withLockConflict(onLockConflict, async (towerId: string) => {
    await apiDeleteTower(showId, towerId)
    towers.value = towers.value.filter(t => t.id !== towerId)
  })

  const assignSlot = withLockConflict(onLockConflict, async (towerId: string, slotIndex: number, channelId: string | null) => {
    await assignTowerSlot(showId, towerId, slotIndex, channelId)
    const tower = towers.value.find(t => t.id === towerId)
    if (tower) {
      const slot = tower.slots.find(s => s.slot_index === slotIndex)
      if (slot) slot.channel_id = channelId
    }
    // channels.mount_ref hat sich serverseitig geändert (siehe writeTowerSlot/
    // clearTowerSlot) — neu laden statt lokal nachzubilden.
    await reloadChannels?.()
  })

  function handleTowersSse() {
    loadTowers()
  }

  return { loading, loadTowers, addTower, saveTower, removeTower, assignSlot, handleTowersSse }
}

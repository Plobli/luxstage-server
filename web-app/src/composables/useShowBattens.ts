import { ref, type Ref } from 'vue'
import { fetchBattens, createBatten, updateBatten, deleteBatten as apiDeleteBatten, deleteAllBattens as apiDeleteAllBattens, addBattenFixture, patchBattenFixtureNotes, removeBattenFixture, reorderBattens as apiReorderBattens, type Batten, type FixtureSide, type AddBattenFixtureOptions } from '../api/battens'
import type { Channel } from '../api/channels'
import { withLockConflict } from './withLockConflict'

// channels.mount_ref (Rückverweis Kanal -> Batten/Fixture) wird ausschließlich
// serverseitig gepflegt (siehe server/db/battens.js writeBattenFixture/removeBattenFixture/
// restoreBattens) — reloadChannels() holt nach jeder Fixture-Änderung den
// aktuellen Stand, statt ihn hier im Client redundant nachzubilden.
export function useShowBattens(showId: string, channels?: Ref<Channel[]>, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void, reloadChannels?: () => Promise<void>) {
  const battens = ref<Batten[]>([])
  const loading = ref(false)

  async function loadBattens() {
    loading.value = true
    try {
      battens.value = await fetchBattens(showId)
    } finally {
      loading.value = false
    }
  }

  const addBatten = withLockConflict(onLockConflict, async (data: Partial<Batten>) => {
    const { id } = await createBatten(showId, data)
    await loadBattens()
    return id
  })

  const saveBatten = withLockConflict(onLockConflict, async (battenId: string, data: Partial<Batten>) => {
    await updateBatten(showId, battenId, data)
    await loadBattens()
  })

  const removeBatten = withLockConflict(onLockConflict, async (battenId: string) => {
    await apiDeleteBatten(showId, battenId)
    battens.value = battens.value.filter(b => b.id !== battenId)
  })

  const removeAllBattens = withLockConflict(onLockConflict, async () => {
    await apiDeleteAllBattens(showId)
    battens.value = []
  })

  const updateFixtureNotes = withLockConflict(onLockConflict, async (battenId: string, fixtureId: string, notes: string) => {
    await patchBattenFixtureNotes(showId, battenId, fixtureId, notes)
    const batten = battens.value.find(b => b.id === battenId)
    if (!batten) return
    const fx = batten.fixtures.find(f => f.id === fixtureId)
    if (fx) fx.notes = notes
  })

  const assignFixture = withLockConflict(onLockConflict, async (battenId: string, position: number, opts: AddBattenFixtureOptions = {}) => {
    const { channelId, label, fixtureId, side, positionText, notes } = opts
    const result = await addBattenFixture(showId, battenId, position, opts)
    const batten = battens.value.find(b => b.id === battenId)
    if (!batten) return

    if (fixtureId) {
      const existing = batten.fixtures.find(f => f.id === fixtureId)
      if (existing) {
        existing.position = position
        if (side !== undefined) existing.side = side
        if (positionText !== undefined) existing.position_text = positionText
        if (label !== undefined) existing.label = label
        if (notes !== undefined) existing.notes = notes
      }
    } else {
      batten.fixtures.push({ id: result.id, batten_id: battenId, channel_id: channelId ?? null, position, notes: notes ?? '', side, position_text: positionText, label })
      batten.fixtures.sort((a, b) => a.position - b.position)
    }

    // channels.mount_ref hat sich serverseitig geändert (siehe writeBattenFixture)
    // — neu laden statt lokal nachzubilden. Bei generischen Elementen (kein
    // channelId) ist mount_ref unverändert, der Reload schadet aber nicht.
    await reloadChannels?.()
  })

  const unassignFixture = withLockConflict(onLockConflict, async (battenId: string, fixtureId: string) => {
    const batten = battens.value.find(b => b.id === battenId)
    await removeBattenFixture(showId, battenId, fixtureId)
    if (batten) batten.fixtures = batten.fixtures.filter(f => f.id !== fixtureId)
    await reloadChannels?.()
  })

  const reorderBattens = withLockConflict(onLockConflict, async (orderedIds: string[]) => {
    await apiReorderBattens(showId, orderedIds)
    battens.value = orderedIds.map(id => battens.value.find(b => b.id === id)!).filter(Boolean)
  })

  return { battens, loading, loadBattens, addBatten, saveBatten, removeBatten, removeAllBattens, assignFixture, updateFixtureNotes, unassignFixture, reorderBattens }
}

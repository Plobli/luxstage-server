import { ref, type Ref } from 'vue'
import { fetchBars, createBar, updateBar, deleteBar as apiDeleteBar, addBarFixture, patchBarFixtureNotes, removeBarFixture, reorderBars as apiReorderBars, type Bar, type FixtureSide } from '../api/bars'
import type { Channel } from '../api/channels'
import { withLockConflict } from './withLockConflict'

// channels.mount_ref (Rückverweis Kanal -> Bar/Fixture) wird ausschließlich
// serverseitig gepflegt (siehe server/db/bars.js writeBarFixture/removeBarFixture/
// restoreBars) — reloadChannels() holt nach jeder Fixture-Änderung den
// aktuellen Stand, statt ihn hier im Client redundant nachzubilden.
export function useShowBars(showId: string, channels?: Ref<Channel[]>, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void, reloadChannels?: () => Promise<void>) {
  const bars = ref<Bar[]>([])
  const loading = ref(false)

  async function loadBars() {
    loading.value = true
    try {
      bars.value = await fetchBars(showId)
    } finally {
      loading.value = false
    }
  }

  const addBar = withLockConflict(onLockConflict, async (data: Partial<Bar>) => {
    const { id } = await createBar(showId, data)
    await loadBars()
    return id
  })

  const saveBar = withLockConflict(onLockConflict, async (barId: string, data: Partial<Bar>) => {
    await updateBar(showId, barId, data)
    await loadBars()
  })

  const removeBar = withLockConflict(onLockConflict, async (barId: string) => {
    await apiDeleteBar(showId, barId)
    bars.value = bars.value.filter(b => b.id !== barId)
  })

  const updateFixtureNotes = withLockConflict(onLockConflict, async (barId: string, fixtureId: string, notes: string) => {
    await patchBarFixtureNotes(showId, barId, fixtureId, notes)
    const bar = bars.value.find(b => b.id === barId)
    if (!bar) return
    const fx = bar.fixtures.find(f => f.id === fixtureId)
    if (fx) fx.notes = notes
  })

  const assignFixture = withLockConflict(onLockConflict, async (barId: string, channelId: string, position: number, fixtureId?: string, side?: FixtureSide, positionText?: string) => {
    const result = await addBarFixture(showId, barId, channelId, position, undefined, fixtureId, side, positionText)
    const bar = bars.value.find(b => b.id === barId)
    if (!bar) return

    if (fixtureId) {
      const existing = bar.fixtures.find(f => f.id === fixtureId)
      if (existing) {
        existing.position = position
        if (side !== undefined) existing.side = side
        if (positionText !== undefined) existing.position_text = positionText
      }
    } else {
      bar.fixtures.push({ id: result.id, bar_id: barId, channel_id: channelId, position, notes: '', side, position_text: positionText })
      bar.fixtures.sort((a, b) => a.position - b.position)
    }

    // channels.mount_ref hat sich serverseitig geändert (siehe writeBarFixture)
    // — neu laden statt lokal nachzubilden.
    await reloadChannels?.()
  })

  const unassignFixture = withLockConflict(onLockConflict, async (barId: string, fixtureId: string) => {
    const bar = bars.value.find(b => b.id === barId)
    await removeBarFixture(showId, barId, fixtureId)
    if (bar) bar.fixtures = bar.fixtures.filter(f => f.id !== fixtureId)
    await reloadChannels?.()
  })

  const reorderBars = withLockConflict(onLockConflict, async (orderedIds: string[]) => {
    await apiReorderBars(showId, orderedIds)
    bars.value = orderedIds.map(id => bars.value.find(b => b.id === id)!).filter(Boolean)
  })

  return { bars, loading, loadBars, addBar, saveBar, removeBar, assignFixture, updateFixtureNotes, unassignFixture, reorderBars }
}

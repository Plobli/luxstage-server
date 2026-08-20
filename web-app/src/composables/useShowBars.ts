import { ref, type Ref } from 'vue'
import { fetchBars, createBar, updateBar, deleteBar as apiDeleteBar, addBarFixture, patchBarFixtureNotes, removeBarFixture, reorderBars as apiReorderBars, type Bar, type FixtureSide } from '../api/bars'
import type { Channel } from '../api/channels'
import { ApiError } from '../api/client'

export function useShowBars(showId: string, channels?: Ref<Channel[]>, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void) {
  const bars = ref<Bar[]>([])
  const loading = ref(false)

  async function loadBars() {
    loading.value = true
    try {
      bars.value = await fetchBars(showId)
      syncMountRefNames()
    } finally {
      loading.value = false
    }
  }

  function syncMountRefNames() {
    if (!channels?.value) return
    const barMap = new Map(bars.value.map(b => [b.id, b]))
    for (const ch of channels.value) {
      if (!ch.mount_ref) continue
      try {
        const ref = typeof ch.mount_ref === 'string' ? JSON.parse(ch.mount_ref) : ch.mount_ref
        if (ref?.type === 'bar') {
          const bar = barMap.get(ref.barId)
          if (bar && bar.name !== ref.barName) {
            ch.mount_ref = JSON.stringify({ ...ref, barName: bar.name })
          }
        }
      } catch {}
    }
  }

  async function addBar(data: Partial<Bar>) {
    try {
      const { id } = await createBar(showId, data)
      await loadBars()
      return id
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
  }

  async function saveBar(barId: string, data: Partial<Bar>) {
    try {
      await updateBar(showId, barId, data)
      await loadBars()
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
  }

  async function removeBar(barId: string) {
    try {
      await apiDeleteBar(showId, barId)
      bars.value = bars.value.filter(b => b.id !== barId)
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
  }

  async function updateFixtureNotes(barId: string, fixtureId: string, notes: string) {
    try {
      await patchBarFixtureNotes(showId, barId, fixtureId, notes)
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
    const bar = bars.value.find(b => b.id === barId)
    if (!bar) return
    const fx = bar.fixtures.find(f => f.id === fixtureId)
    if (fx) fx.notes = notes
  }

  async function assignFixture(barId: string, channelId: string, position: number, fixtureId?: string, side?: FixtureSide, positionText?: string) {
    let result: { id: string }
    try {
      result = await addBarFixture(showId, barId, channelId, position, undefined, fixtureId, side, positionText)
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
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

    if (channels?.value) {
      const ch = channels.value.find(c => c.id === channelId)
      if (ch) {
        ch.mount_ref = JSON.stringify({
          type: 'bar',
          barId,
          barName: bar.name,
          zugNr: bar.zug_nr,
          barType: bar.bar_type,
          position,
        })
      }
    }
  }

  async function unassignFixture(barId: string, fixtureId: string) {
    const bar = bars.value.find(b => b.id === barId)
    const fx = bar?.fixtures.find(f => f.id === fixtureId)
    try {
      await removeBarFixture(showId, barId, fixtureId)
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
    if (bar) bar.fixtures = bar.fixtures.filter(f => f.id !== fixtureId)

    if (channels?.value && fx?.channel_id) {
      const ch = channels.value.find(c => c.id === fx.channel_id)
      if (ch) ch.mount_ref = null
    }
  }

  async function reorderBars(orderedIds: string[]) {
    try {
      await apiReorderBars(showId, orderedIds)
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) { onLockConflict?.(e.body); return }
      throw e
    }
    bars.value = orderedIds.map(id => bars.value.find(b => b.id === id)!).filter(Boolean)
  }

  return { bars, loading, loadBars, addBar, saveBar, removeBar, assignFixture, updateFixtureNotes, unassignFixture, reorderBars }
}

import { ref, type Ref } from 'vue'
import { fetchBars, createBar, updateBar, deleteBar as apiDeleteBar, addBarFixture, patchBarFixtureNotes, removeBarFixture, reorderBars as apiReorderBars, type Bar, type FixtureSide } from '../api/bars'
import type { Channel } from '../api/channels'

export function useShowBars(showId: string, channels?: Ref<Channel[]>) {
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
    const { id } = await createBar(showId, data)
    await loadBars()
    return id
  }

  async function saveBar(barId: string, data: Partial<Bar>) {
    await updateBar(showId, barId, data)
    await loadBars()
  }

  async function removeBar(barId: string) {
    await apiDeleteBar(showId, barId)
    bars.value = bars.value.filter(b => b.id !== barId)
  }

  async function updateFixtureNotes(barId: string, fixtureId: string, notes: string) {
    await patchBarFixtureNotes(showId, barId, fixtureId, notes)
    const bar = bars.value.find(b => b.id === barId)
    if (!bar) return
    const fx = bar.fixtures.find(f => f.id === fixtureId)
    if (fx) fx.notes = notes
  }

  async function assignFixture(barId: string, channelId: string, position: number, fixtureId?: string, side?: FixtureSide, positionText?: string) {
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
    await removeBarFixture(showId, barId, fixtureId)
    if (bar) bar.fixtures = bar.fixtures.filter(f => f.id !== fixtureId)

    if (channels?.value && fx?.channel_id) {
      const ch = channels.value.find(c => c.id === fx.channel_id)
      if (ch) ch.mount_ref = null
    }
  }

  async function reorderBars(orderedIds: string[]) {
    await apiReorderBars(showId, orderedIds)
    bars.value = orderedIds.map(id => bars.value.find(b => b.id === id)!).filter(Boolean)
  }

  return { bars, loading, loadBars, addBar, saveBar, removeBar, assignFixture, updateFixtureNotes, unassignFixture, reorderBars }
}

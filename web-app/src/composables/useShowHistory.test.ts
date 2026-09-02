import { describe, test, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

const fetchHistory = vi.fn()
const fetchHistoryEntry = vi.fn()
const restoreHistory = vi.fn()

vi.mock('../api/shows.js', () => ({
  fetchHistory: (...a: any[]) => fetchHistory(...a),
  fetchHistoryEntry: (...a: any[]) => fetchHistoryEntry(...a),
  restoreHistory: (...a: any[]) => restoreHistory(...a),
}))

const { useShowHistory } = await import('./useShowHistory')

const deps = () => ({ loadChannels: vi.fn(), loadSections: vi.fn() })

beforeEach(() => {
  fetchHistory.mockReset().mockResolvedValue([{ id: 'e1', created_at: 1 }])
  fetchHistoryEntry.mockReset().mockResolvedValue({ id: 'e1', channels: [] })
  restoreHistory.mockReset().mockResolvedValue(undefined)
})

describe('useShowHistory', () => {
  test('lädt die Einträge erst beim Öffnen', async () => {
    const h = useShowHistory('s1', deps())
    expect(fetchHistory).not.toHaveBeenCalled()

    h.openHistory()
    await nextTick()
    await vi.waitFor(() => expect(h.entries.value).toHaveLength(1))
    expect(fetchHistory).toHaveBeenCalledWith('s1')
  })

  test('setzt Fehlertext, wenn das Laden scheitert', async () => {
    fetchHistory.mockRejectedValue(new Error('netz'))
    const h = useShowHistory('s1', deps())
    h.openHistory()
    await nextTick()
    await vi.waitFor(() => expect(h.error.value).toBeTruthy())
    expect(h.loading.value).toBe(false)
  })

  test('eine überholte Antwort überschreibt die neuere nicht', async () => {
    const h = useShowHistory('s1', deps())

    let releaseFirst: (v: any) => void = () => {}
    fetchHistoryEntry.mockImplementationOnce(() => new Promise(r => { releaseFirst = r }))
    fetchHistoryEntry.mockResolvedValueOnce({ id: 'zweite' })

    const first = h.loadEntry('e1')
    const second = h.loadEntry('e2')
    await second
    releaseFirst({ id: 'erste' })
    await first

    expect(h.currentEntry.value).toEqual({ id: 'zweite' })
  })

  test('Schließen verwirft die Detailansicht', async () => {
    const h = useShowHistory('s1', deps())
    h.openHistory()
    await nextTick()
    await h.loadEntry('e1')
    expect(h.currentEntry.value).not.toBeNull()

    h.historyOpen.value = false
    await nextTick()
    expect(h.currentEntry.value).toBeNull()
  })

  test('restore lädt Kanäle und Sections neu und schließt den Verlauf', async () => {
    const d = deps()
    const h = useShowHistory('s1', d)
    h.historyOpen.value = true

    await h.restore({ id: 'e1' })

    expect(restoreHistory).toHaveBeenCalledWith('s1', 'e1')
    expect(d.loadChannels).toHaveBeenCalled()
    expect(d.loadSections).toHaveBeenCalled()
    expect(h.historyOpen.value).toBe(false)
  })
})

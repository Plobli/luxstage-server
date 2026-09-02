import { ref, watch, type Ref } from 'vue'
import { restoreHistory, fetchHistory, fetchHistoryEntry } from '../api/shows.js'

/**
 * Versionsverlauf einer Show: Liste laden, einzelne Version ansehen,
 * wiederherstellen. Der Datenzugriff liegt hier statt in HistorySlideOver.vue,
 * damit die Komponente ohne laufenden Server darstellbar und testbar bleibt.
 */
export interface HistoryEntry {
  id: string;
  created_at?: number;
  channels?: Array<Record<string, any>>;
}

export function useShowHistory(showId: string, { loadChannels, loadSections }: {
  loadChannels: () => Promise<unknown> | unknown;
  loadSections: () => Promise<unknown> | unknown;
}) {
  const historyOpen = ref(false)
  const entries = ref<HistoryEntry[]>([])
  const currentEntry = ref<HistoryEntry | null>(null)
  const loading = ref(false)
  const error = ref('')

  // Verwirft Antworten überholter Anfragen: schnelles Öffnen/Schließen oder
  // Klicken mehrerer Versionen darf nicht die zuletzt angeforderte überschreiben.
  let requestVersion = 0

  async function run<T>(fn: () => Promise<T>, errorMessage: string): Promise<{ ok: boolean, result?: T }> {
    const version = ++requestVersion
    loading.value = true
    error.value = ''
    try {
      const result = await fn()
      if (version === requestVersion) return { ok: true, result }
    } catch {
      if (version === requestVersion) error.value = errorMessage
    } finally {
      if (version === requestVersion) loading.value = false
    }
    return { ok: false }
  }

  function openHistory() {
    historyOpen.value = true
  }

  async function loadEntries() {
    currentEntry.value = null
    const { ok, result } = await run(() => fetchHistory(showId), 'Versionsverlauf konnte nicht geladen werden.')
    if (ok) entries.value = result!
  }

  async function loadEntry(id: string): Promise<void> {
    const { ok, result } = await run(() => fetchHistoryEntry(showId, id), 'Version konnte nicht geladen werden.')
    if (ok) currentEntry.value = result!
  }

  async function restore(entry: HistoryEntry): Promise<void> {
    await restoreHistory(showId, entry.id)
    await Promise.all([loadChannels(), loadSections()])
    historyOpen.value = false
  }

  watch(historyOpen, open => {
    if (open) loadEntries()
    else { currentEntry.value = null; requestVersion++ }
  })

  return { historyOpen, entries, currentEntry, loading, error, openHistory, loadEntry, restore }
}

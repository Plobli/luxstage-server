import { ref } from 'vue'
import { restoreHistory } from '../api/shows.js'

export function useShowHistory(showId, { pushSnapshot, loadChannels, loadSections }) {
  const historyOpen = ref(false)

  function openHistory() {
    historyOpen.value = true
  }

  async function restore(entry) {
    pushSnapshot()
    await restoreHistory(showId, entry.id)
    await Promise.all([loadChannels(), loadSections()])
    historyOpen.value = false
  }

  return { historyOpen, openHistory, restore }
}
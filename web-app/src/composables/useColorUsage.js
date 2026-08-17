import { ref } from 'vue'
import { fetchColorUsage } from '@/api/channels'
import { normalizeInput } from '@/utils/filterColors'

// Echtes Modul-Singleton (außerhalb jeder Komponenteninstanz): ein Fetch für
// alle ColorAutocomplete-Instanzen, die pro Tabellenzeile einmal existieren.
const colorUsageRank = ref(new Map())
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  fetchColorUsage().then(rows => {
    // Rohwerte wie "201", "L201", "l201" bezeichnen denselben Filter, kommen
    // in der DB aber als unterschiedliche Strings vor — vor dem Rangieren auf
    // den kanonischen Filtercode normalisieren und Counts zusammenführen.
    const counts = new Map()
    for (const r of rows) {
      const code = normalizeInput(r.color) ?? r.color.trim().toUpperCase()
      counts.set(code, (counts.get(code) ?? 0) + r.count)
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const map = new Map()
    ranked.forEach(([code], i) => map.set(code, i))
    colorUsageRank.value = map
  }).catch(() => { loaded = false })
}

export function useColorUsage() {
  load()
  return { colorUsageRank }
}

import { ref, type Ref } from 'vue'
import { loadDisplaySettingsOnce, saveDisplaySettings } from '../api/settings'

const STORAGE_KEY = 'photo_print_per_page'
const VALID = [1, 2, 4, 6, 8, 9, 12]
const DEFAULT = 4

// localStorage dient nur als Cache für den ersten Render — maßgeblich ist der
// Server, damit die Einstellung nicht am Browser klebt und der PDF-Export
// denselben Wert sieht.
const storedStr = localStorage.getItem(STORAGE_KEY)
const stored = storedStr ? parseInt(storedStr, 10) : NaN
const photosPerPage = ref<number>(VALID.includes(stored) ? stored : DEFAULT)

if (typeof window !== 'undefined') {
  loadDisplaySettingsOnce().then(data => {
    const n = data?.photos_per_page
    if (VALID.includes(n)) {
      photosPerPage.value = n
      localStorage.setItem(STORAGE_KEY, String(n))
    }
  }).catch(() => {})

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return
    const n = parseInt(e.newValue, 10)
    if (VALID.includes(n)) photosPerPage.value = n
  })
}

function setPhotosPerPage(n: number): void {
  if (!VALID.includes(n)) return
  photosPerPage.value = n
  localStorage.setItem(STORAGE_KEY, String(n))
  saveDisplaySettings({ photos_per_page: n }).catch(() => {})
}

export function usePhotoSettings(): { photosPerPage: Ref<number>, setPhotosPerPage: (n: number) => void, VALID: number[] } {
  return { photosPerPage, setPhotosPerPage, VALID }
}

import { ref, computed } from 'vue'

// Globaler State – von ShowDetailView befüllt, von App.vue gelesen
const _items = ref([])
const _activeKey = ref(null)
const _navigate = ref(null)
const _addSection = ref(null)
const _deleteSection = ref(null)

export function useShowNav() {
  function setNav({ items, activeKey, navigate, addSection, deleteSection }) {
    _items.value = items
    _activeKey.value = activeKey
    _navigate.value = navigate
    _addSection.value = addSection
    _deleteSection.value = deleteSection
  }

  function clearNav() {
    _items.value = []
    _activeKey.value = null
    _navigate.value = null
    _addSection.value = null
    _deleteSection.value = null
  }

  function navigate(item) {
    _navigate.value?.(item)
  }

  function addSection() {
    _addSection.value?.()
  }

  function deleteSection(sectionId) {
    _deleteSection.value?.(sectionId)
  }

  return {
    navItems: computed(() => _items.value),
    activeKey: computed(() => _activeKey.value),
    setNav,
    clearNav,
    navigate,
    addSection,
    deleteSection,
  }
}

import { ref, watch } from 'vue'

const TAB_TIMEOUT_MS = 24 * 60 * 60 * 1000

export function useShowTabs(showId, subTabs, { onLeaveChannels }) {
  const tabKey = `show-tab-${showId}`
  const subTabKey = `show-subtab-${showId}`
  const tabTimeKey = `show-tab-time-${showId}`
  const isTimedOut = Date.now() - Number(localStorage.getItem(tabTimeKey) || 0) > TAB_TIMEOUT_MS

  const mobileTab = ref(isTimedOut ? 'channels' : (sessionStorage.getItem(tabKey) || 'channels'))
  const aufbauTab = ref(isTimedOut ? null : (sessionStorage.getItem(subTabKey) ?? null))
  const visitedTabs = ref(new Set([mobileTab.value]))

  if (!localStorage.getItem(tabTimeKey)) localStorage.setItem(tabTimeKey, String(Date.now()))

  watch(mobileTab, tab => visitedTabs.value.add(tab))
  watch(mobileTab, tab => {
    sessionStorage.setItem(tabKey, tab)
    localStorage.setItem(tabTimeKey, String(Date.now()))
    if (tab === 'floorplan' || (tab === 'gassenturm' && !aufbauTab.value)) {
      aufbauTab.value = subTabs.value[0]?.key ?? null
    }
    if (tab !== 'channels') onLeaveChannels()
  })
  watch(aufbauTab, tab => {
    if (tab) sessionStorage.setItem(subTabKey, tab)
  })
  watch(subTabs, tabs => {
    if (!tabs.find(tab => tab.key === aufbauTab.value)) {
      aufbauTab.value = tabs[0]?.key ?? null
    }
  })

  function tabMounted(tab) {
    return visitedTabs.value.has(tab)
  }

  return { mobileTab, aufbauTab, tabMounted }
}
import { computed, watch, onUnmounted } from 'vue'
import {
  Image as NavPhotosIcon,
  Map as NavFloorplanIcon,
  TriangleAlert as IconHinweise,
} from 'lucide-vue-next'
import IconKanaele from '../components/icons/IconKanaele.vue'
import IconBeleuchtungsgestelle from '../components/icons/IconBeleuchtungsgestelle.vue'
import IconObermaschinerie from '../components/icons/IconObermaschinerie.vue'
import IconAufbau from '../components/icons/IconAufbau.vue'
import IconRaum from '../components/icons/IconRaum.vue'
import { useShowNav } from './useShowNav.js'

// Abschnitts-Symbole über den stabilen icon-Bezeichner aus der DB, nicht über
// den Titel: der ist frei editierbar und sprachabhängig. Unbekannte oder leere
// Werte fallen auf IconAufbau zurück.
const SECTION_ICONS = {
  warning: IconHinweise,
  room: IconRaum,
  setup: IconAufbau,
}

// Baut die Haupt-Sidebar-Navigation einer Show (Kanäle, Aufbau-Subtabs,
// benutzerdefinierte Sections, Fotos, Grundriss) und meldet sie über
// useShowNav an App.vue. Kapselt nur die Item-Berechnung — das Senden/Lesen
// des globalen Nav-State bleibt in useShowNav.
export function useShowSidebarNav({ t, meta, mobileTab, aufbauTab, sectionDefs, onSidebarNavigate, addSectionFromSubtab }) {
  const { setNav, clearNav } = useShowNav()

  const sidebarNavItems = computed(() => {
    const activeTab = mobileTab.value
    const activeSubTab = aufbauTab.value
    const items = []

    items.push({
      key: 'channels',
      label: t('tab.channels'),
      icon: IconKanaele,
      iconClass: 'size-6',
      active: activeTab === 'channels',
      navigate: () => onSidebarNavigate({ tab: 'channels' }),
    })

    if (meta.value.use_towers !== false) {
      items.push({
        key: 'gassenturm',
        label: t('tab.towers'),
        icon: IconBeleuchtungsgestelle,
        iconClass: 'size-6',
        active: activeTab === 'gassenturm' && activeSubTab === 'gassenturm',
        navigate: () => onSidebarNavigate({ tab: 'gassenturm', subTab: 'gassenturm' }),
      })
    }
    if (meta.value.use_bars !== false) {
      items.push({
        key: 'zugstangen',
        label: t('tab.obermaschinerie'),
        icon: IconObermaschinerie,
        iconClass: 'size-6',
        active: activeTab === 'gassenturm' && activeSubTab === 'zugstangen',
        navigate: () => onSidebarNavigate({ tab: 'gassenturm', subTab: 'zugstangen' }),
      })
    }
    for (const s of [...sectionDefs.value].sort((a, b) => a.order - b.order)) {
      items.push({
        key: `section:${s.id}`,
        label: s.title || t('sections.untitled'),
        icon: SECTION_ICONS[s.icon] ?? IconAufbau,
        iconClass: s.icon === 'warning' ? 'size-5' : 'size-6',
        active: activeTab === 'gassenturm' && activeSubTab === `section:${s.id}`,
        navigate: () => onSidebarNavigate({ tab: 'gassenturm', subTab: `section:${s.id}` }),
      })
    }
    items.push({ type: 'addSection', label: t('sections.add') })

    items.push({ type: 'group', label: t('show.nav.media') })

    items.push({
      key: 'photos',
      label: t('tab.photos'),
      icon: NavPhotosIcon,
      active: activeTab === 'photos',
      navigate: () => onSidebarNavigate({ tab: 'photos' }),
    })
    items.push({
      key: 'floorplan',
      label: t('tab.floorplan'),
      icon: NavFloorplanIcon,
      active: activeTab === 'floorplan',
      navigate: () => onSidebarNavigate({ tab: 'floorplan' }),
    })

    return items
  })

  watch(sidebarNavItems, (items) => {
    setNav({
      items,
      activeKey: mobileTab.value,
      navigate: (item) => item.navigate?.(),
      addSection: addSectionFromSubtab,
    })
  }, { immediate: true })

  onUnmounted(() => clearNav())

  const aufbauNavVisible = computed(() =>
    meta.value.use_towers !== false || meta.value.use_bars !== false || sectionDefs.value.length > 0
  )

  return { sidebarNavItems, aufbauNavVisible }
}

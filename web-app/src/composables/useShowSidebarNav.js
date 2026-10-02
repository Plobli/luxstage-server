import { computed, watch, onUnmounted } from 'vue'
import {
  Image as NavPhotosIcon,
  Map as NavDrawingPlanIcon,
  TriangleAlert as IconHinweise,
} from 'lucide-vue-next'
import IconKanaele from '../components/icons/IconKanaele.vue'
import IconBeleuchtungsgestelle from '../components/icons/IconBeleuchtungsgestelle.vue'
import IconObermaschinerie from '../components/icons/IconObermaschinerie.vue'
import IconSetupPlan from '../components/icons/IconSetupPlan.vue'
import IconRaum from '../components/icons/IconRaum.vue'
import { useShowNav } from './useShowNav.js'

// Abschnitts-Symbole über den stabilen icon-Bezeichner aus der DB, nicht über
// den Titel: der ist frei editierbar und sprachabhängig. Unbekannte oder leere
// Werte fallen auf IconSetupPlan zurück.
const SECTION_ICONS = {
  warning: IconHinweise,
  room: IconRaum,
  setup: IconSetupPlan,
}

// Baut die Haupt-Sidebar-Navigation einer Show (Kanäle, Aufbau-Subtabs,
// benutzerdefinierte Sections, Fotos, Grundriss) und meldet sie über
// useShowNav an App.vue. Kapselt nur die Item-Berechnung — das Senden/Lesen
// des globalen Nav-State bleibt in useShowNav.
export function useShowSidebarNav({ t, meta, mobileTab, setupPlanTab, sectionDefs, onSidebarNavigate, addSectionFromSubtab, deleteSection, renameSection }) {
  const { setNav, clearNav } = useShowNav()

  const sidebarNavItems = computed(() => {
    const activeTab = mobileTab.value
    const activeSubTab = setupPlanTab.value
    const items = []

    items.push({
      key: 'channels',
      label: t('tab.channels'),
      icon: IconKanaele,
      iconClass: 'size-6',
      active: activeTab === 'channels',
      navigate: () => onSidebarNavigate({ tab: 'channels' }),
    })

    const sortedSections = [...sectionDefs.value].sort((a, b) => a.order - b.order)
    const setupSection = sortedSections.find(s => s.icon === 'setup')
    const otherSections = sortedSections.filter(s => s.icon !== 'setup')

    const pushSection = (s) => {
      items.push({
        key: `section:${s.id}`,
        label: s.title || t('sections.untitled'),
        icon: SECTION_ICONS[s.icon] ?? IconSetupPlan,
        iconClass: s.icon === 'warning' ? 'size-5' : 'size-6',
        active: activeTab === 'setup' && activeSubTab === `section:${s.id}`,
        navigate: () => onSidebarNavigate({ tab: 'setup', subTab: `section:${s.id}` }),
        sectionId: s.icon === 'setup' ? null : s.id,
        renameId: s.id,
      })
    }

    if (setupSection) pushSection(setupSection)

    if (meta.value.use_towers !== false) {
      items.push({
        key: 'lightingTower',
        label: t('tab.towers'),
        icon: IconBeleuchtungsgestelle,
        iconClass: 'size-6',
        active: activeTab === 'setup' && activeSubTab === 'lightingTower',
        navigate: () => onSidebarNavigate({ tab: 'setup', subTab: 'lightingTower' }),
      })
    }
    if (meta.value.use_battens !== false) {
      items.push({
        key: 'flySystem',
        label: t('tab.fly_system'),
        icon: IconObermaschinerie,
        iconClass: 'size-6',
        active: activeTab === 'setup' && activeSubTab === 'flySystem',
        navigate: () => onSidebarNavigate({ tab: 'setup', subTab: 'flySystem' }),
      })
    }
    for (const s of otherSections) pushSection(s)
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
      key: 'drawingPlan',
      label: t('tab.drawing_plan'),
      icon: NavDrawingPlanIcon,
      active: activeTab === 'drawingPlan',
      navigate: () => onSidebarNavigate({ tab: 'drawingPlan' }),
    })

    return items
  })

  watch(sidebarNavItems, (items) => {
    setNav({
      items,
      activeKey: mobileTab.value,
      navigate: (item) => item.navigate?.(),
      addSection: addSectionFromSubtab,
      deleteSection,
      renameSection,
    })
  }, { immediate: true })

  onUnmounted(() => clearNav())

  const setupPlanNavVisible = computed(() =>
    meta.value.use_towers !== false || meta.value.use_battens !== false || sectionDefs.value.length > 0
  )

  return { sidebarNavItems, setupPlanNavVisible }
}

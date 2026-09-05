import { ref, computed } from 'vue'

// Elemente-Tabelle in NetworkView.vue: Raum-Gruppierung/Ein-Klappen, Suche und die
// UI-lokalen Zustände für neu angelegte Elemente/Raum-Inline-Editing. Bewusst NICHT
// hier: createNode/updateNode/removeNode selbst (kommen aus useNetworkGraph, analog
// useShowBars/useShowTowers) — dieser Composable bündelt nur die Tabellen-UI darüber.

export function useNetworkElementsTable(nodes, nodesById, graph, createNode, t) {
  const roomOptions = computed(() => [...new Set(nodes.value.map(n => n.room).filter(Boolean))].sort())

  // Elemente-Tabelle nach Raum gruppiert statt einer einzigen langen Liste —
  // Räume alphabetisch, Elemente ohne Raum am Ende. Jede Gruppe individuell
  // einklappbar, damit man sich auf einen Raum konzentrieren kann.
  const groupedNodes = computed(() => {
    const map = new Map()
    for (const n of nodes.value) {
      const key = n.room || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(n)
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b)
    })
    return keys.map(key => ({ key, room: key, nodes: map.get(key) }))
  })
  // Räume starten eingeklappt (sonst wieder eine lange Liste) — nur explizit
  // geöffnete Räume merken sich das.
  const expandedGroups = ref({})
  function toggleGroup(key) {
    expandedGroups.value = { ...expandedGroups.value, [key]: !expandedGroups.value[key] }
  }
  // Während einer Suche sind Treffer-Räume immer aufgeklappt — sonst würde die
  // Suche Elemente in eingeklappten Räumen unsichtbar "finden".
  function isGroupCollapsed(key) {
    if (elementSearch.value.trim()) return false
    return !expandedGroups.value[key]
  }

  const elementSearch = ref('')
  const filteredGroupedNodes = computed(() => {
    const q = elementSearch.value.trim().toLowerCase()
    if (!q) return groupedNodes.value
    return groupedNodes.value
      .map(group => ({
        ...group,
        nodes: group.nodes.filter(n =>
          (n.label || '').toLowerCase().includes(q) ||
          t('network.type.' + n.type).toLowerCase().includes(q) ||
          (group.room || '').toLowerCase().includes(q)
        ),
      }))
      .filter(group => group.nodes.length)
  })

  // Neu angelegtes Element bleibt hervorgehoben, bis der Nutzer eines seiner
  // Felder bearbeitet — sonst ist es in der Liste nicht von bestehenden
  // Elementen zu unterscheiden. Rein UI-Zustand, daher hier statt in
  // useNetworkGraph (das nur das erzeugte Element zurückgibt).
  const newNodeId = ref(null)
  const editingRoomId = ref(null)

  async function addNode(type) {
    const node = await createNode(type)
    if (node) {
      newNodeId.value = node.id
      expandedGroups.value = { ...expandedGroups.value, [node.room || '']: true }
    }
  }
  async function saveNode(node, patch) {
    if (newNodeId.value === node.id) newNodeId.value = null
    await graph.updateNode(node, patch)
  }

  function onRoomSelect(node, room) {
    if (room === '__new__') { editingRoomId.value = node.id; return }
    saveNode(node, { room })
  }
  function confirmNewRoom(node, room) {
    editingRoomId.value = null
    saveNode(node, { room })
  }
  // Nur Switches haben nummerierte Ports — Dosen und Geräte werden ohne Portnummer verbunden.
  function hasPort(nodeId) { return nodesById.value.get(nodeId)?.type === 'switch' }

  return {
    roomOptions, groupedNodes, expandedGroups, toggleGroup, isGroupCollapsed,
    elementSearch, filteredGroupedNodes,
    newNodeId, editingRoomId,
    addNode, saveNode, onRoomSelect, confirmNewRoom, hasPort,
  }
}

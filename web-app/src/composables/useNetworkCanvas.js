import { ref } from 'vue'
import dagre from 'dagre'
import { updateNetworkNode } from '../api/network.ts'

// Vue-Flow-Darstellung des Netzwerkgraphen in NetworkView.vue: Knoten-/Kanten-Sync
// (syncFlow), automatisches dagre-Layout für neu angelegte Elemente ohne gespeicherte
// Position, Raum-Hintergrundboxen, Pfad-Hervorhebung per Klick, und die "Automatisch
// anordnen"-Funktion (verbundene Komponenten einzeln layouten, dann zu Zeilen packen).
// Zustand + CRUD kommen aus useNetworkGraph (analog useShowBars/useShowTowers) und
// werden hier nur gelesen/über updateNetworkNode persistiert — dieser Composable
// besitzt keinen eigenen Server-Zustand.

const ROOM_PADDING = 32
const GROUP_GAP_X = 160
const GROUP_GAP_Y = 160

export function useNetworkCanvas({ nodes, connections, nodesById, hasPort, graph, t, nodeIconMap, Cable }) {
  const flowNodes = ref([])
  const flowEdges = ref([])

  function isPortUsed(nodeId, port) {
    const p = String(port)
    return connections.value.some(c =>
      (c.from_node_id === nodeId && c.from_port === p) || (c.to_node_id === nodeId && c.to_port === p)
    )
  }

  // Geschätzte Kastengröße pro Knotentyp — für das Auto-Layout (dagre) und die
  // Raum-Hintergrundbox (Bounding-Box um die enthaltenen Elemente).
  function nodeSize(n) {
    if (n.type === 'switch') return { width: Math.max(200, Math.ceil((n.port_count || 0) / 2) * 40), height: 140 }
    return { width: 224, height: 44 }
  }

  function layoutMissingPositions() {
    const unplaced = nodes.value.filter(n => n.position_x == null || n.position_y == null)
    if (!unplaced.length) return

    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 140 })
    g.setDefaultEdgeLabel(() => ({}))
    for (const n of nodes.value) {
      g.setNode(n.id, nodeSize(n))
    }
    for (const c of connections.value) {
      if (nodesById.value.has(c.from_node_id) && nodesById.value.has(c.to_node_id)) {
        g.setEdge(c.from_node_id, c.to_node_id)
      }
    }
    dagre.layout(g)

    const updated = []
    for (const n of unplaced) {
      const p = g.node(n.id)
      if (!p) continue
      n.position_x = Math.round(p.x)
      n.position_y = Math.round(p.y)
      updated.push(n)
    }
    // Bleibt bewusst synchron (syncFlow() ruft dies aus vielen Stellen ohne
    // await auf) — Fehler werden hier nur gemeldet, ein Rollback ergibt keinen
    // Sinn: die Knoten hatten zuvor keine (also keine sinnvoll wiederherstellbare) Position.
    if (updated.length) {
      Promise.allSettled(updated.map(n => updateNetworkNode(n.id, n))).then(results => {
        const failed = results.find(r => r.status === 'rejected')
        if (failed) graph.reportNetworkError(failed.reason)
      })
    }
  }

  // Räume haben keine eigene gespeicherte Position — die Box wird als lose
  // Hintergrundfläche aus der Bounding-Box ihrer aktuellen Elemente berechnet
  // und zieht beim Verschieben eines Elements automatisch mit.
  // Stabiler Farbton je Raumname (Hash), damit jede Gruppe einen eigenen,
  // dezenten Hintergrund bekommt und derselbe Raum immer dieselbe Farbe behält.
  function roomHue(room) {
    let hash = 0
    for (let i = 0; i < room.length; i++) hash = (hash * 31 + room.charCodeAt(i)) | 0
    return Math.abs(hash) % 360
  }

  function buildRoomNodes(elementNodes) {
    const groups = new Map()
    for (const fn of elementNodes) {
      const room = nodesById.value.get(fn.id)?.room
      if (!room) continue
      if (!groups.has(room)) groups.set(room, [])
      groups.get(room).push(fn)
    }
    return [...groups.entries()].map(([room, members]) => {
      const minX = Math.min(...members.map(m => m.position.x)) - ROOM_PADDING
      const minY = Math.min(...members.map(m => m.position.y)) - ROOM_PADDING - 20
      const maxX = Math.max(...members.map(m => m.position.x + m.width)) + ROOM_PADDING
      const maxY = Math.max(...members.map(m => m.position.y + m.height)) + ROOM_PADDING
      return {
        id: `room:${room}`,
        type: 'room',
        position: { x: minX, y: minY },
        width: maxX - minX,
        height: maxY - minY,
        data: { label: room, hue: roomHue(room) },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -1,
      }
    })
  }

  function syncFlow() {
    layoutMissingPositions()

    const elementNodes = nodes.value.map(n => {
      const { width, height } = nodeSize(n)
      return {
        id: n.id,
        type: n.type === 'switch' ? 'switch' : 'device',
        position: { x: n.position_x ?? 0, y: n.position_y ?? 0 },
        width,
        height,
        data: {
          label: n.label || t('network.type.' + n.type),
          icon: nodeIconMap[n.type] || Cable,
          elementType: n.type,
          portCount: n.port_count,
          isPortUsed: (p) => isPortUsed(n.id, p),
          isMain: !!n.is_main,
          mainLabel: t('network.main_switch'),
        },
      }
    })

    flowNodes.value = [...buildRoomNodes(elementNodes), ...elementNodes]

    const highlightEdgeIds = highlightedNodeId.value ? pathEdgeIdsToSwitch(highlightedNodeId.value) : null

    flowEdges.value = connections.value
      .filter(c => nodesById.value.has(c.from_node_id) && nodesById.value.has(c.to_node_id))
      .map(c => ({
        id: c.id,
        source: c.from_node_id,
        target: c.to_node_id,
        sourceHandle: hasPort(c.from_node_id) && c.from_port ? c.from_port : undefined,
        targetHandle: hasPort(c.to_node_id) && c.to_port ? c.to_port : undefined,
        label: c.cable_type || undefined,
        class: highlightEdgeIds?.has(c.id) ? 'network-edge-highlight' : undefined,
      }))
  }

  // Klick auf ein Element hebt nur den einen Weg zurück zum Switch hervor
  // (nicht den ganzen Baum) — Klick auf die leere Fläche oder dasselbe
  // Element wieder hebt die Hervorhebung auf.
  const highlightedNodeId = ref(null)

  function pathEdgeIdsToSwitch(startNodeId) {
    if (nodesById.value.get(startNodeId)?.type === 'switch') return new Set()

    const adjacency = new Map()
    for (const c of connections.value) {
      if (!adjacency.has(c.from_node_id)) adjacency.set(c.from_node_id, [])
      if (!adjacency.has(c.to_node_id)) adjacency.set(c.to_node_id, [])
      adjacency.get(c.from_node_id).push({ edgeId: c.id, other: c.to_node_id })
      adjacency.get(c.to_node_id).push({ edgeId: c.id, other: c.from_node_id })
    }

    // Kürzester Weg (BFS) zum nächsten Switch, mit Vorgänger-Verfolgung.
    const visited = new Set([startNodeId])
    const cameFrom = new Map() // nodeId -> { edgeId, fromNodeId }
    const queue = [startNodeId]
    let switchId = null
    while (queue.length && !switchId) {
      const cur = queue.shift()
      for (const { edgeId, other } of adjacency.get(cur) || []) {
        if (visited.has(other)) continue
        visited.add(other)
        cameFrom.set(other, { edgeId, fromNodeId: cur })
        if (nodesById.value.get(other)?.type === 'switch') { switchId = other; break }
        queue.push(other)
      }
    }
    if (!switchId) return new Set()

    const edgeIds = new Set()
    let cur = switchId
    while (cur !== startNodeId) {
      const step = cameFrom.get(cur)
      if (!step) break
      edgeIds.add(step.edgeId)
      cur = step.fromNodeId
    }
    return edgeIds
  }

  function onNodeClick({ node }) {
    if (node.type === 'room') return
    highlightedNodeId.value = highlightedNodeId.value === node.id ? null : node.id
    syncFlow()
  }
  function clearHighlight() {
    if (!highlightedNodeId.value) return
    highlightedNodeId.value = null
    syncFlow()
  }

  // Automatisch anordnen: jede zusammenhängende Kabelstrecke (ein Switch +
  // alles was an ihm hängt) wird einzeln per dagre layoutet (Räume darin als
  // Compound-Cluster, überlappen sich nicht), danach werden diese Blöcke
  // nebeneinander gepackt — Blöcke mit Hauptswitch in einer Zeile ganz oben,
  // alle anderen darunter in einer zweiten Zeile. So landen mehrere
  // Hauptswitches nie untereinander. Positionen werden sofort gespeichert.
  function connectedComponents() {
    const parent = new Map(nodes.value.map(n => [n.id, n.id]))
    function find(x) { while (parent.get(x) !== x) x = parent.get(x); return x }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
    for (const c of connections.value) {
      if (nodesById.value.has(c.from_node_id) && nodesById.value.has(c.to_node_id)) {
        union(c.from_node_id, c.to_node_id)
      }
    }
    const groups = new Map()
    for (const n of nodes.value) {
      const root = find(n.id)
      if (!groups.has(root)) groups.set(root, [])
      groups.get(root).push(n)
    }
    return [...groups.values()]
  }

  function layoutComponent(members) {
    const memberIds = new Set(members.map(m => m.id))
    const g = new dagre.graphlib.Graph({ compound: true })
    g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 140 })
    g.setDefaultEdgeLabel(() => ({}))

    const rooms = new Set(members.map(n => n.room).filter(Boolean))
    for (const room of rooms) g.setNode(`room:${room}`, {})
    for (const n of members) {
      g.setNode(n.id, nodeSize(n))
      if (n.room) g.setParent(n.id, `room:${n.room}`)
    }
    for (const c of connections.value) {
      if (memberIds.has(c.from_node_id) && memberIds.has(c.to_node_id)) g.setEdge(c.from_node_id, c.to_node_id)
    }
    dagre.layout(g)

    for (const n of members) {
      const p = g.node(n.id)
      if (!p) continue
      n.position_x = p.x
      n.position_y = p.y
    }
    const minX = Math.min(...members.map(m => m.position_x))
    const minY = Math.min(...members.map(m => m.position_y))
    const maxX = Math.max(...members.map(m => m.position_x + nodeSize(m).width))
    const maxY = Math.max(...members.map(m => m.position_y + nodeSize(m).height))
    const isMain = members.some(m => m.type === 'switch' && m.is_main)
    return { members, minX, minY, width: maxX - minX, height: maxY - minY, isMain }
  }

  function packRow(blocks, startY) {
    let x = 0
    let maxHeight = 0
    for (const block of blocks) {
      const offsetX = x - block.minX
      const offsetY = startY - block.minY
      for (const m of block.members) {
        m.position_x = Math.round(m.position_x + offsetX)
        m.position_y = Math.round(m.position_y + offsetY)
      }
      x += block.width + GROUP_GAP_X
      maxHeight = Math.max(maxHeight, block.height)
    }
    return startY + maxHeight + GROUP_GAP_Y
  }

  function autoArrange() {
    graph.clearNetworkError()
    const before = new Map(nodes.value.map(n => [n.id, { x: n.position_x, y: n.position_y }]))

    const blocks = connectedComponents().map(layoutComponent)
    const mainBlocks = blocks.filter(b => b.isMain)
    const otherBlocks = blocks.filter(b => !b.isMain)

    const nextY = packRow(mainBlocks, 0)
    packRow(otherBlocks, nextY)

    syncFlow()
    // Stabile Kopie der Node-Referenzen zum Zeitpunkt des Dispatch — results[i]
    // muss auf dieselbe Node zeigen, unabhängig davon, ob nodes.value bis zum
    // Abschluss der Requests neu zugewiesen/umsortiert wird (vgl. restoreLayout()).
    const dispatched = nodes.value
    Promise.allSettled(dispatched.map(n => updateNetworkNode(n.id, n))).then(results => {
      let hadFailure = false
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          hadFailure = true
          const n = dispatched[i]
          const prev = n && before.get(n.id)
          if (n && prev) { n.position_x = prev.x; n.position_y = prev.y }
        }
      })
      if (hadFailure) {
        syncFlow()
        graph.reportNetworkError(results.find(r => r.status === 'rejected').reason)
      }
    })
  }

  function onNodeDragStop({ node }) {
    if (node.type === 'room') return
    const source = nodesById.value.get(node.id)
    if (!source) return
    graph.clearNetworkError()
    const before = { x: source.position_x, y: source.position_y }
    source.position_x = Math.round(node.position.x)
    source.position_y = Math.round(node.position.y)
    updateNetworkNode(source.id, source).catch(e => {
      source.position_x = before.x
      source.position_y = before.y
      syncFlow()
      graph.reportNetworkError(e)
    })
    syncFlow()
  }

  return {
    flowNodes, flowEdges, isPortUsed, nodeSize, syncFlow,
    highlightedNodeId, onNodeClick, clearHighlight,
    autoArrange, onNodeDragStop,
  }
}

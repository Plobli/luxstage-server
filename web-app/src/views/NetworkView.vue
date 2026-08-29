<template>
  <div class="px-4 py-8 sm:px-6 lg:px-8">
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.network') }}</h1>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-muted-foreground">…</div>

    <template v-else>
      <!-- Topologie (automatisch aus den Tabellen generiert, frei verschiebbar) -->
      <Card class="mb-6" :class="isFullscreen ? 'fixed inset-4 z-50 flex flex-col' : ''">
        <CardHeader class="flex flex-row items-center justify-between">
          <CardTitle class="text-base">{{ t('network.topology') }}</CardTitle>
          <div v-if="nodes.length" class="flex gap-2">
            <Button variant="outline" size="sm" @click="autoArrange">
              <LayoutGrid class="size-3.5" /> {{ t('network.auto_arrange') }}
            </Button>
            <Button variant="outline" size="sm" @click="restoreLayout" :disabled="!hasSavedLayout">
              <RotateCcw class="size-3.5" /> {{ t('network.restore_view') }}
            </Button>
            <Button variant="outline" size="sm" @click="saveLayout">
              <Save class="size-3.5" /> {{ t('network.save_view') }}
            </Button>
            <Button variant="outline" size="sm" @click="isFullscreen = !isFullscreen">
              <component :is="isFullscreen ? Minimize2 : Maximize2" class="size-3.5" />
              {{ isFullscreen ? t('network.exit_fullscreen') : t('network.fullscreen') }}
            </Button>
          </div>
        </CardHeader>
        <CardContent :class="isFullscreen ? 'flex-1 min-h-0' : ''">
          <div v-if="!nodes.length" class="text-sm text-muted-foreground py-8 text-center">
            {{ t('network.topology.empty') }}
          </div>
          <div v-else class="w-full rounded-lg border border-border/60 bg-surface-high/30 overflow-hidden" :class="isFullscreen ? 'h-full' : 'h-[600px]'">
            <VueFlow
              v-model:nodes="flowNodes"
              v-model:edges="flowEdges"
              :node-types="flowNodeTypes"
              class="w-full h-full"
              :default-edge-options="{ type: 'smoothstep' }"
              fit-view-on-init
              @node-drag-stop="onNodeDragStop"
              @node-click="onNodeClick"
              @pane-click="clearHighlight"
            >
              <Background :gap="16" />
              <Controls />
            </VueFlow>
          </div>
        </CardContent>
      </Card>

      <!-- Elemente -->
      <Card class="mb-6">
        <CardHeader>
          <CardTitle class="text-base">{{ t('network.elements') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-40">{{ t('network.type') }}</TableHead>
                <TableHead>{{ t('network.label') }}</TableHead>
                <TableHead class="w-56">{{ t('network.room') }}</TableHead>
                <TableHead class="w-28">{{ t('network.port_count') }}</TableHead>
                <TableHead class="w-28">{{ t('network.main_switch') }}</TableHead>
                <TableHead class="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="node in nodes" :key="node.id">
                <TableCell>
                  <Select :model-value="node.type" @update:model-value="v => saveNode(node, { type: v })">
                    <SelectTrigger class="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in nodeTypes" :key="opt" :value="opt">{{ t('network.type.' + opt) }}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input class="h-8" :model-value="node.label" @change="e => saveNode(node, { label: e.target.value })" />
                </TableCell>
                <TableCell>
                  <Input
                    v-if="editingRoomId === node.id"
                    class="h-8" autofocus
                    :model-value="node.room"
                    :placeholder="t('network.room')"
                    @keydown.enter="e => confirmNewRoom(node, e.target.value)"
                    @blur="e => confirmNewRoom(node, e.target.value)"
                  />
                  <Select v-else :model-value="node.room || undefined" @update:model-value="v => onRoomSelect(node, v)">
                    <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.no_room')" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="r in roomOptions" :key="r" :value="r">{{ r }}</SelectItem>
                      <SelectItem value="__new__">{{ t('network.new_room') }}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    v-if="node.type === 'switch'"
                    class="h-8" type="number" min="1"
                    :model-value="node.port_count"
                    @change="e => saveNode(node, { port_count: e.target.value ? Number(e.target.value) : null })"
                  />
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell>
                  <Checkbox
                    v-if="node.type === 'switch'"
                    :model-value="!!node.is_main"
                    @update:model-value="v => saveNode(node, { is_main: v ? 1 : 0 })"
                  />
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="removeNode(node)">
                    <Trash2 class="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" class="mt-3" @click="addNode">
            <Plus class="size-3.5" /> {{ t('network.add_element') }}
          </Button>
        </CardContent>
      </Card>

      <!-- Verbindungen -->
      <Card class="mb-6">
        <CardHeader>
          <CardTitle class="text-base">{{ t('network.connections') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('network.from') }}</TableHead>
                <TableHead class="w-32">{{ t('network.port') }}</TableHead>
                <TableHead>{{ t('network.to') }}</TableHead>
                <TableHead class="w-32">{{ t('network.port') }}</TableHead>
                <TableHead class="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="conn in sortedConnections" :key="conn.id">
                <TableCell>
                  <Select :model-value="conn.from_node_id" @update:model-value="v => saveConnection(conn, { from_node_id: v })">
                    <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="n in nodes" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select v-if="portOptions(conn.from_node_id).length" :model-value="conn.from_port" @update:model-value="v => saveConnection(conn, { from_port: v })">
                    <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.port')" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="p in portOptions(conn.from_node_id)" :key="p" :value="String(p)">{{ p }}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input v-else-if="hasPort(conn.from_node_id)" class="h-8" :model-value="conn.from_port" @change="e => saveConnection(conn, { from_port: e.target.value })" />
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell>
                  <Select :model-value="conn.to_node_id" @update:model-value="v => saveConnection(conn, { to_node_id: v })">
                    <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="n in nodes" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select v-if="portOptions(conn.to_node_id).length" :model-value="conn.to_port" @update:model-value="v => saveConnection(conn, { to_port: v })">
                    <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.port')" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="p in portOptions(conn.to_node_id)" :key="p" :value="String(p)">{{ p }}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input v-else-if="hasPort(conn.to_node_id)" class="h-8" :model-value="conn.to_port" @change="e => saveConnection(conn, { to_port: e.target.value })" />
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="removeConnection(conn)">
                    <Trash2 class="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" class="mt-3" :disabled="nodes.length < 2" @click="addConnection">
            <Plus class="size-3.5" /> {{ t('network.add_connection') }}
          </Button>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue'
import { Plus, Trash2, Cable, MonitorSmartphone, Network as NetworkIcon, LayoutGrid, Save, RotateCcw, Maximize2, Minimize2 } from 'lucide-vue-next'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import dagre from 'dagre'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import { useLocale } from '../composables/useLocale.js'
import {
  listNetworkNodes, createNetworkNode, updateNetworkNode, deleteNetworkNode,
  listNetworkConnections, createNetworkConnection, updateNetworkConnection, deleteNetworkConnection,
  getNetworkLayoutSnapshot, saveNetworkLayoutSnapshot,
} from '../api/network.ts'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SwitchNode from '@/components/network/SwitchNode.vue'
import DeviceNode from '@/components/network/DeviceNode.vue'
import RoomNode from '@/components/network/RoomNode.vue'

const { t } = useLocale()

const nodeTypes = ['dose', 'switch', 'geraet']
const nodeIconMap = { dose: Cable, switch: NetworkIcon, geraet: MonitorSmartphone }
const flowNodeTypes = markRaw({ switch: SwitchNode, device: DeviceNode, room: RoomNode })

const loading = ref(true)
const nodes = ref([])
const connections = ref([])
const isFullscreen = ref(false)
function onFullscreenKeydown(e) {
  if (e.key === 'Escape' && isFullscreen.value) isFullscreen.value = false
}
onMounted(() => window.addEventListener('keydown', onFullscreenKeydown))
onUnmounted(() => window.removeEventListener('keydown', onFullscreenKeydown))

const nodesById = computed(() => new Map(nodes.value.map(n => [n.id, n])))
function connectionLabel(nodeId) {
  const n = nodesById.value.get(nodeId)
  return n ? (n.label || t('network.type.' + n.type)) : ''
}
const sortedConnections = computed(() => [...connections.value].sort((a, b) => {
  const fromCmp = connectionLabel(a.from_node_id).localeCompare(connectionLabel(b.from_node_id))
  if (fromCmp) return fromCmp
  const portCmp = String(a.from_port ?? '').localeCompare(String(b.from_port ?? ''), undefined, { numeric: true })
  if (portCmp) return portCmp
  return connectionLabel(a.to_node_id).localeCompare(connectionLabel(b.to_node_id))
}))

// Raum-Auswahl per Dropdown statt Freitext — vermeidet Tippfehler, die die
// Gruppierung in der Topologie unsichtbar durchbrechen würden.
const roomOptions = computed(() => [...new Set(nodes.value.map(n => n.room).filter(Boolean))].sort())
const editingRoomId = ref(null)
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
// Ist die Portanzahl des Switch bekannt, wird der Port aus einer festen Liste gewählt statt frei eingegeben.
function portOptions(nodeId) {
  const node = nodesById.value.get(nodeId)
  if (node?.type !== 'switch' || !node.port_count) return []
  return Array.from({ length: node.port_count }, (_, i) => i + 1)
}

const hasSavedLayout = ref(false)

onMounted(async () => {
  try {
    let snapshot
    ;[nodes.value, connections.value, snapshot] = await Promise.all([
      listNetworkNodes(), listNetworkConnections(), getNetworkLayoutSnapshot(),
    ])
    hasSavedLayout.value = !!snapshot
  } finally {
    loading.value = false
  }
  syncFlow()
})

// Speichert die aktuellen Positionen als Snapshot, den man später per Klick
// wiederherstellen kann — unabhängig von der laufenden Auto-Speicherung
// beim Verschieben einzelner Elemente.
async function saveLayout() {
  const data = {}
  for (const n of nodes.value) {
    if (n.position_x != null && n.position_y != null) data[n.id] = { x: n.position_x, y: n.position_y }
  }
  await saveNetworkLayoutSnapshot(data)
  hasSavedLayout.value = true
}

async function restoreLayout() {
  const snapshot = await getNetworkLayoutSnapshot()
  if (!snapshot) return
  for (const n of nodes.value) {
    const pos = snapshot.data[n.id]
    if (!pos) continue
    n.position_x = pos.x
    n.position_y = pos.y
    updateNetworkNode(n.id, n)
  }
  syncFlow()
}

async function addNode() {
  const node = await createNetworkNode({ type: 'dose', label: '', room: '', port_count: null, is_main: 0 })
  nodes.value.push(node)
  syncFlow()
}

async function saveNode(node, patch) {
  Object.assign(node, patch)
  await updateNetworkNode(node.id, node)
  syncFlow()
}

async function removeNode(node) {
  await deleteNetworkNode(node.id)
  nodes.value = nodes.value.filter(n => n.id !== node.id)
  connections.value = connections.value.filter(c => c.from_node_id !== node.id && c.to_node_id !== node.id)
  syncFlow()
}

async function addConnection() {
  const conn = await createNetworkConnection({ from_node_id: nodes.value[0]?.id || '', from_port: '', to_node_id: nodes.value[1]?.id || '', to_port: '', cable_type: '' })
  connections.value.push(conn)
  syncFlow()
}

async function saveConnection(conn, patch) {
  Object.assign(conn, patch)
  await updateNetworkConnection(conn.id, conn)
  syncFlow()
}

async function removeConnection(conn) {
  await deleteNetworkConnection(conn.id)
  connections.value = connections.value.filter(c => c.id !== conn.id)
  syncFlow()
}

// Interaktiver Graph (Vue Flow): Elemente sind frei verschiebbare Knoten,
// Kabel sind Kanten, die sich beim Verschieben automatisch mitziehen.
// Neue Elemente ohne gespeicherte Position werden per dagre einmalig
// automatisch angeordnet (Switches links als Ausgangspunkt); danach bleibt
// die vom Nutzer gewählte Position erhalten.
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

  for (const n of unplaced) {
    const p = g.node(n.id)
    if (!p) continue
    n.position_x = Math.round(p.x)
    n.position_y = Math.round(p.y)
    updateNetworkNode(n.id, n)
  }
}

const ROOM_PADDING = 32

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

const GROUP_GAP_X = 160
const GROUP_GAP_Y = 160

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
  const blocks = connectedComponents().map(layoutComponent)
  const mainBlocks = blocks.filter(b => b.isMain)
  const otherBlocks = blocks.filter(b => !b.isMain)

  const nextY = packRow(mainBlocks, 0)
  packRow(otherBlocks, nextY)

  for (const n of nodes.value) updateNetworkNode(n.id, n)
  syncFlow()
}

function onNodeDragStop({ node }) {
  if (node.type === 'room') return
  const source = nodesById.value.get(node.id)
  if (!source) return
  source.position_x = Math.round(node.position.x)
  source.position_y = Math.round(node.position.y)
  updateNetworkNode(source.id, source)
  syncFlow()
}
</script>

<style scoped>
:deep(.network-edge-highlight .vue-flow__edge-path) {
  stroke: var(--color-destructive);
  stroke-width: 2.5;
}
</style>

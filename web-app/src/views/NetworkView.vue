<template>
  <div class="px-4 py-8 sm:px-6 lg:px-8">
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.network') }}</h1>
        <span v-if="networkError" class="text-xs text-destructive" role="alert">{{ networkError }}</span>
        <span v-else-if="isLockedByOther" class="text-xs text-orange-500" role="status">
          {{ t('lock.lockedBy', { user: lock?.user }) }}
        </span>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" :disabled="!canUndo" :title="t('action.undo')" @click="undo">
          <Undo2 class="size-3.5" />
        </Button>
        <Button variant="outline" size="sm" :disabled="!canRedo" :title="t('action.redo')" @click="redo">
          <Redo2 class="size-3.5" />
        </Button>
        <Button variant="outline" size="sm" @click="exportPdf">
          <FileText class="size-3.5" /> {{ t('network.export_pdf') }}
        </Button>
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
              edges-updatable
              @node-drag-stop="onNodeDragStop"
              @node-click="onNodeClick"
              @pane-click="clearHighlight"
              @connect="onConnect"
              @edge-update="onEdgeUpdate"
              @edges-change="onEdgesChange"
              @nodes-change="onNodesChange"
            >
              <Background :gap="16" />
              <Controls />
            </VueFlow>
          </div>
        </CardContent>
      </Card>

      <!-- Verbindungen -->
      <Card class="mb-6">
        <CardHeader>
          <CardTitle class="text-base">{{ t('network.connections') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <!-- Ein Grid pro Switch statt einer Tabelle — sonst steht "Von: Unifi-671d"
               bei 24 Ports 24x da, ohne echten Informationsgewinn. -->
          <div v-for="sw in switchNodes" :key="sw.id" class="mb-6 last:mb-0">
            <div class="flex items-center gap-2 mb-2">
              <NetworkIcon class="size-4 text-muted-foreground shrink-0" />
              <span class="text-sm font-medium">{{ sw.label || t('network.type.switch') }}</span>
              <span v-if="sw.is_main" class="text-[10px] uppercase tracking-wide text-primary font-medium">{{ t('network.main_switch') }}</span>
              <span v-if="sw.port_count" class="text-xs text-muted-foreground">({{ usedPortCount(sw) }}/{{ sw.port_count }})</span>
            </div>
            <div v-if="sw.port_count" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5">
              <div
                v-for="row in switchPortRows(sw)" :key="row.port"
                class="flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1"
                :class="row.conn ? '' : 'bg-accent/10'"
              >
                <span class="text-xs text-muted-foreground w-5 shrink-0 tabular-nums text-right">{{ row.port }}</span>
                <Select :model-value="row.targetId || '__empty__'" @update:model-value="v => setPortTarget(sw, row.port, v === '__empty__' ? null : v)">
                  <SelectTrigger class="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">{{ t('network.port_empty') }}</SelectItem>
                    <SelectItem v-for="n in portTargetOptions(sw)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  v-if="row.targetIsSwitch"
                  class="h-7 w-12 text-xs shrink-0" :placeholder="t('network.port')"
                  :model-value="row.targetPort"
                  @change="e => setPortTargetPort(row.conn, sw.id, e.target.value)"
                />
              </div>
            </div>
            <div v-else class="text-sm text-muted-foreground">{{ t('network.no_ports') }}</div>
          </div>

          <!-- Verbindungen ohne beteiligten Switch (z.B. Gerät direkt an Gerät). -->
          <template v-if="otherConnections.length || pendingConnections.length">
            <div class="text-sm font-medium mb-2" :class="switchNodes.length ? 'mt-2' : ''">{{ t('network.other_connections') }}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('network.from') }}</TableHead>
                  <TableHead>{{ t('network.to') }}</TableHead>
                  <TableHead class="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="conn in otherConnections" :key="conn.id">
                  <TableCell>
                    <Select :model-value="conn.from_node_id" @update:model-value="v => updateConnectionEndpoint(conn, 'from', v)">
                      <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="n in connectionPartnerOptions(conn.to_node_id)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select :model-value="conn.to_node_id" @update:model-value="v => updateConnectionEndpoint(conn, 'to', v)">
                      <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="n in connectionPartnerOptions(conn.from_node_id)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="removeConnection(conn)">
                      <Trash2 class="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
                <!-- Entwürfe: noch nicht gespeichert, solange nicht beide Elemente gewählt sind. -->
                <TableRow v-for="draft in pendingConnections" :key="draft.id" class="bg-primary/10">
                  <TableCell>
                    <Select :model-value="draft.from_node_id || undefined" @update:model-value="v => commitPendingConnection(draft, { from_node_id: v })">
                      <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="n in connectionPartnerOptions(draft.to_node_id)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select :model-value="draft.to_node_id || undefined" @update:model-value="v => commitPendingConnection(draft, { to_node_id: v })">
                      <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="n in connectionPartnerOptions(draft.from_node_id)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="removePendingConnection(draft)">
                      <Trash2 class="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>

          <Button variant="outline" size="sm" class="mt-3" :disabled="nodes.length < 2" @click="addConnection">
            <Plus class="size-3.5" /> {{ t('network.add_connection') }}
          </Button>
        </CardContent>
      </Card>

      <!-- Elemente -->
      <Card class="mb-6">
        <CardHeader class="flex flex-row items-center justify-between gap-4">
          <CardTitle class="text-base shrink-0">{{ t('network.elements') }}</CardTitle>
          <div class="relative w-56">
            <Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input v-model="elementSearch" class="h-8 pl-7" :placeholder="t('action.search')" />
          </div>
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
              <template v-for="group in filteredGroupedNodes" :key="group.key">
                <TableRow class="bg-surface-high/40 hover:bg-surface-high/40 cursor-pointer select-none" @click="toggleGroup(group.key)">
                  <TableCell colspan="6" class="py-1.5">
                    <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <component :is="isGroupCollapsed(group.key) ? ChevronRight : ChevronDown" class="size-3.5" />
                      {{ group.room || t('network.no_room') }}
                      <span class="text-xs font-normal">({{ group.nodes.length }})</span>
                    </div>
                  </TableCell>
                </TableRow>
                <template v-if="!isGroupCollapsed(group.key)">
                  <TableRow v-for="node in group.nodes" :key="node.id" :class="node.id === newNodeId ? 'bg-primary/10' : ''">
                    <TableCell>
                      <Select :model-value="node.type" @update:model-value="v => saveNode(node, { type: v })">
                        <SelectTrigger class="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="opt in nodeTypes" :key="opt" :value="opt">{{ t('network.type.' + opt) }}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <Input class="h-8" :model-value="node.label" @change="e => saveNode(node, { label: e.target.value })" />
                        <span v-if="node.id === newNodeId" class="text-[10px] uppercase tracking-wide text-primary font-medium shrink-0">{{ t('network.new') }}</span>
                      </div>
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
                </template>
              </template>
            </TableBody>
          </Table>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" class="mt-3">
                <Plus class="size-3.5" /> {{ t('network.add_element') }} <ChevronDown class="size-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem v-for="opt in nodeTypes" :key="opt" class="cursor-pointer" @click="addNode(opt)">
                {{ t('network.type.' + opt) }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue'
import { Plus, Trash2, Cable, MonitorSmartphone, Network as NetworkIcon, LayoutGrid, Save, RotateCcw, Maximize2, Minimize2, ChevronDown, ChevronRight, FileText, Search, Undo2, Redo2 } from 'lucide-vue-next'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import dagre from 'dagre'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import { useLocale } from '../composables/useLocale.js'
import { api } from '../api/client.js'
import { updateNetworkNode } from '../api/network.ts'
import { useNetworkGraph } from '../composables/useNetworkGraph'
import { isValidConnectionPair } from '@shared/constants.js'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import SwitchNode from '@/components/network/SwitchNode.vue'
import DeviceNode from '@/components/network/DeviceNode.vue'
import RoomNode from '@/components/network/RoomNode.vue'

const { t } = useLocale()

async function exportPdf() {
  const url = await api.downloadUrl('/api/network/pdf')
  window.open(url, '_blank')
}

const nodeTypes = ['dose', 'switch', 'geraet']
const nodeIconMap = { dose: Cable, switch: NetworkIcon, geraet: MonitorSmartphone }
const flowNodeTypes = markRaw({ switch: SwitchNode, device: DeviceNode, room: RoomNode })

const isFullscreen = ref(false)
function onFullscreenKeydown(e) {
  if (e.key === 'Escape' && isFullscreen.value) isFullscreen.value = false
}

// Zustand + CRUD kommen aus useNetworkGraph (analog useShowBars/useShowTowers) —
// hier bleibt nur, was mit der VueFlow-Darstellung selbst zu tun hat
// (syncFlow, dagre-Layout, Port-Grid/Raum-Ableitung), siehe Kommentar dort.
const graph = useNetworkGraph(() => syncFlow())
const {
  loading, nodes, connections, networkError, hasSavedLayout,
  lock, isLockedByOther,
  nodesById, connectionLabel,
  undo, redo, canUndo, canRedo, onUndoRedoKeydown,
  createNode, deleteNodeSilently, removeNode,
  saveConnection, deleteConnectionSilently, removeConnection, updateConnectionEndpoint,
  setPortTarget, setPortTargetPort, connFieldForNode, portConnection,
  pendingConnections, addPendingConnection: addConnection, commitPendingConnection, removePendingConnection,
  saveLayout, restoreLayout,
} = graph

function onNetworkKeydown(e) {
  onFullscreenKeydown(e)
  onUndoRedoKeydown(e)
}
onMounted(() => window.addEventListener('keydown', onNetworkKeydown))
onUnmounted(() => window.removeEventListener('keydown', onNetworkKeydown))

const sortedConnections = computed(() => [...connections.value].sort((a, b) => {
  const fromCmp = connectionLabel(a.from_node_id).localeCompare(connectionLabel(b.from_node_id))
  if (fromCmp) return fromCmp
  const portCmp = String(a.from_port ?? '').localeCompare(String(b.from_port ?? ''), undefined, { numeric: true })
  if (portCmp) return portCmp
  return connectionLabel(a.to_node_id).localeCompare(connectionLabel(b.to_node_id))
}))

// Verbindungen als Port-Grid pro Switch statt Tabelle: ein Switch mit 24
// Ports tauchte sonst 24x identisch in der "Von"-Spalte auf. Hauptswitches
// zuerst, dann alphabetisch.
const switchNodes = computed(() => [...nodes.value]
  .filter(n => n.type === 'switch')
  .sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || (a.label || '').localeCompare(b.label || '')))

function portTargetNodeId(conn, switchId) {
  return connFieldForNode(conn, switchId) === 'from' ? conn.to_node_id : conn.from_node_id
}
function portTargetPort(conn, switchId) {
  return connFieldForNode(conn, switchId) === 'from' ? conn.to_port : conn.from_port
}
function switchPortRows(sw) {
  return Array.from({ length: sw.port_count || 0 }, (_, i) => {
    const port = i + 1
    const conn = portConnection(sw.id, port)
    if (!conn) return { port, conn: null, targetId: null, targetPort: null, targetIsSwitch: false }
    const targetId = portTargetNodeId(conn, sw.id)
    return { port, conn, targetId, targetPort: portTargetPort(conn, sw.id), targetIsSwitch: nodesById.value.get(targetId)?.type === 'switch' }
  })
}
function usedPortCount(sw) {
  return connections.value.filter(c => connFieldForNode(c, sw.id)).length
}
// Alphabetisch sortierte Zielauswahl je Switch-Port.
function portTargetOptions(sw) {
  return [...nodes.value]
    .filter(n => n.id !== sw.id)
    .sort((a, b) => connectionLabel(a.id).localeCompare(connectionLabel(b.id)))
}

// Verbindungen, an denen kein Switch beteiligt ist, tauchen in keinem
// Port-Grid auf — dafür bleibt eine kleine, klassische Tabelle.
const otherConnections = computed(() => sortedConnections.value.filter(c =>
  nodesById.value.get(c.from_node_id)?.type !== 'switch' && nodesById.value.get(c.to_node_id)?.type !== 'switch'
))

// isValidConnectionPair/maxConnectionsForType: siehe shared/constants.js —
// dieselbe Regel muss client- und serverseitig (routes/network.js) gelten.
function connectionPartnerOptions(otherSideNodeId) {
  const otherType = otherSideNodeId ? nodesById.value.get(otherSideNodeId)?.type : null
  return nodes.value.filter(n => n.id !== otherSideNodeId && isValidConnectionPair(otherType, n.type))
}

// Raum-Auswahl per Dropdown statt Freitext — vermeidet Tippfehler, die die
// Gruppierung in der Topologie unsichtbar durchbrechen würden.
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

onMounted(() => { graph.loadInitial() })

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

// Verbindung direkt in der Topologie ziehen (Handle zu Handle) statt nur
// über die Dropdowns im Port-Grid — die Handles existierten schon, es fehlte
// nur der Connect-Handler, der daraus eine echte, gespeicherte Verbindung macht.
async function onConnect({ source, sourceHandle, target, targetHandle }) {
  if (!source || !target || source === target) return
  const sourceNode = nodesById.value.get(source)
  const targetNode = nodesById.value.get(target)
  if (!sourceNode || !targetNode) return
  if (!isValidConnectionPair(sourceNode.type, targetNode.type)) return
  if (!(await graph.claimNodeSlot(source, null))) return
  if (!(await graph.claimNodeSlot(target, null))) return
  await graph.createConnection({
    from_node_id: source,
    from_port: sourceNode.type === 'switch' ? (sourceHandle || '') : '',
    to_node_id: target,
    to_port: targetNode.type === 'switch' ? (targetHandle || '') : '',
    cable_type: '',
  })
}

// Bestehende Verbindung direkt in der Topologie umhängen: Kante am Endpunkt
// packen und auf ein anderes Handle ziehen (edges-updatable) — ändert die
// bestehende Verbindung statt eine zweite anzulegen.
async function onEdgeUpdate({ edge, connection }) {
  const conn = connections.value.find(c => c.id === edge.id)
  if (!conn) return
  const { source, sourceHandle, target, targetHandle } = connection
  if (!source || !target || source === target) return
  const sourceNode = nodesById.value.get(source)
  const targetNode = nodesById.value.get(target)
  if (!sourceNode || !targetNode) return
  if (!isValidConnectionPair(sourceNode.type, targetNode.type)) return
  if (!(await graph.claimNodeSlot(source, conn.id))) return
  if (!(await graph.claimNodeSlot(target, conn.id))) return
  await saveConnection(conn, {
    from_node_id: source,
    from_port: sourceNode.type === 'switch' ? (sourceHandle || '') : '',
    to_node_id: target,
    to_port: targetNode.type === 'switch' ? (targetHandle || '') : '',
  })
}

// Vue Flow löscht Elemente per Backspace/Delete rein lokal im v-model, ohne
// die API zu informieren — die Verbindung/das Element verschwand dadurch nur
// scheinbar und kam beim nächsten syncFlow() (z.B. nach dem Neuverknüpfen)
// wieder zum Vorschein, weil `connections`/`nodes` unverändert blieben. Beide
// Change-Events abfangen und die Löschung tatsächlich persistieren.
function onEdgesChange(changes) {
  for (const change of changes) {
    if (change.type !== 'remove') continue
    const conn = connections.value.find(c => c.id === change.id)
    if (conn) deleteConnectionSilently(conn)
  }
}
function onNodesChange(changes) {
  for (const change of changes) {
    if (change.type !== 'remove') continue
    const node = nodesById.value.get(change.id)
    if (node) deleteNodeSilently(node)
  }
}
</script>

<style scoped>
:deep(.network-edge-highlight .vue-flow__edge-path) {
  stroke: var(--color-destructive);
  stroke-width: 2.5;
}
</style>

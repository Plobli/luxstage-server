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
      <NetworkConnectionsCard
        :nodes="nodes"
        :switchNodes="switchNodes"
        :otherConnections="otherConnections"
        :pendingConnections="pendingConnections"
        :usedPortCount="usedPortCount"
        :switchPortRows="switchPortRows"
        :portTargetOptions="portTargetOptions"
        :connectionPartnerOptions="connectionPartnerOptions"
        @setPortTarget="setPortTarget"
        @setPortTargetPort="setPortTargetPort"
        @updateConnectionEndpoint="updateConnectionEndpoint"
        @removeConnection="removeConnection"
        @commitPendingConnection="commitPendingConnection"
        @removePendingConnection="removePendingConnection"
        @addConnection="addConnection"
      />

      <!-- Elemente -->
      <NetworkElementsTable
        :nodeTypes="nodeTypes"
        :elementSearch="elementSearch"
        :filteredGroupedNodes="filteredGroupedNodes"
        :isGroupCollapsed="isGroupCollapsed"
        :newNodeId="newNodeId"
        :editingRoomId="editingRoomId"
        :roomOptions="roomOptions"
        @update:elementSearch="elementSearch = $event"
        @toggleGroup="toggleGroup"
        @saveNode="saveNode"
        @confirmNewRoom="confirmNewRoom"
        @roomSelect="onRoomSelect"
        @removeNode="removeNode"
        @addNode="addNode"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue'
import { Cable, MonitorSmartphone, Network as NetworkIcon, LayoutGrid, Save, RotateCcw, Maximize2, Minimize2, FileText, Undo2, Redo2 } from 'lucide-vue-next'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import { useLocale } from '../composables/useLocale.js'
import { api } from '../api/client.js'
import { useNetworkGraph } from '../composables/useNetworkGraph'
import { useNetworkElementsTable } from '../composables/useNetworkElementsTable.js'
import { useNetworkCanvas } from '../composables/useNetworkCanvas.js'
import { isValidConnectionPair } from '@shared/constants.js'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SwitchNode from '@/components/network/SwitchNode.vue'
import DeviceNode from '@/components/network/DeviceNode.vue'
import RoomNode from '@/components/network/RoomNode.vue'
import NetworkConnectionsCard from '@/components/network/NetworkConnectionsCard.vue'
import NetworkElementsTable from '@/components/network/NetworkElementsTable.vue'

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

const {
  roomOptions, groupedNodes, expandedGroups, toggleGroup, isGroupCollapsed,
  elementSearch, filteredGroupedNodes,
  newNodeId, editingRoomId,
  addNode, saveNode, onRoomSelect, confirmNewRoom, hasPort,
} = useNetworkElementsTable(nodes, nodesById, graph, createNode, t)

onMounted(() => { graph.loadInitial() })

// Interaktiver Graph (Vue Flow): Elemente sind frei verschiebbare Knoten,
// Kabel sind Kanten, die sich beim Verschieben automatisch mitziehen.
// Neue Elemente ohne gespeicherte Position werden per dagre einmalig
// automatisch angeordnet (Switches links als Ausgangspunkt); danach bleibt
// die vom Nutzer gewählte Position erhalten.
const {
  flowNodes, flowEdges, isPortUsed, nodeSize, syncFlow,
  highlightedNodeId, onNodeClick, clearHighlight,
  autoArrange, onNodeDragStop,
} = useNetworkCanvas({ nodes, connections, nodesById, hasPort, graph, t, nodeIconMap, Cable })

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

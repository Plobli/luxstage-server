// web-app/src/composables/useNetworkGraph.ts
// Zustand + CRUD für die Netzwerk-Topologie (Elemente, Verbindungen, Lock,
// Undo/Redo) — analog zu useShowBars/useShowTowers für den Show-Bereich.
// Bewusst NICHT hier: alles, was mit der VueFlow-Darstellung selbst zu tun
// hat (syncFlow, dagre-Layout, Port-Grid-Ableitung) — das bleibt in
// NetworkView.vue, aus demselben Grund wie bei FloorplanEditor.vue: eine
// Aufspaltung von Domain-Logik und Rendering auf zwei Dateien versteckt die
// Kopplung nur, statt sie aufzulösen. syncFlow() wird daher als Callback
// hereingereicht statt hier importiert.
import { ref, computed, onUnmounted } from 'vue'
import {
  listNetworkNodes, createNetworkNode, updateNetworkNode, deleteNetworkNode,
  listNetworkConnections, createNetworkConnection, updateNetworkConnection, deleteNetworkConnection,
  getNetworkLayoutSnapshot, saveNetworkLayoutSnapshot, undoNetwork, redoNetwork,
  acquireNetworkLock, releaseNetworkLock, touchNetworkLock,
  type NetworkNode, type NetworkConnection,
} from '../api/network.ts'
import { useResourceLock } from './useResourceLock'
import { useServerUndoRedo } from './useUndoRedo'
import { useConfirm } from './useConfirm.js'
import { useLocale } from './useLocale.js'
import { ApiError } from '../api/client.js'
import { isValidConnectionPair, maxConnectionsForType } from '@shared/constants.js'

interface PendingConnection { id: string, from_node_id: string, to_node_id: string }

export function useNetworkGraph(syncFlow: () => void) {
  const { t } = useLocale()
  const { confirm } = useConfirm()

  const loading = ref(true)
  const nodes = ref<NetworkNode[]>([])
  const connections = ref<NetworkConnection[]>([])
  const networkError = ref<string | null>(null)
  const hasSavedLayout = ref(false)

  // Gebäudeweiter Schreib-Lock (siehe Backend: server/db/resource-locks.js) —
  // verhindert, dass zwei Personen die Netzwerk-Topologie gleichzeitig
  // bearbeiten und sich gegenseitig überschreiben.
  const { lock, isLockedByOther, acquireOnOpen, releaseOnClose, syncLockFromConflict } = useResourceLock({
    acquire: acquireNetworkLock,
    release: releaseNetworkLock,
    touch: touchNetworkLock,
  })

  function reportNetworkError(e: any) {
    if (e instanceof ApiError && e.status === 423) syncLockFromConflict(e.body)
    networkError.value = e instanceof ApiError ? e.message : t('error.save_failed')
  }
  // An jedem neuen Mutationsversuch aufgerufen, bevor der Request läuft — sonst
  // bliebe eine einmal gesetzte Fehlermeldung dauerhaft stehen, auch nachdem
  // spätere Aktionen wieder erfolgreich waren.
  function clearNetworkError() {
    networkError.value = null
  }

  const nodesById = computed(() => new Map(nodes.value.map(n => [n.id, n])))
  function connectionLabel(nodeId: string) {
    const n = nodesById.value.get(nodeId)
    return n ? (n.label || t('network.type.' + n.type)) : ''
  }

  async function reloadNetwork() {
    ;[nodes.value, connections.value] = await Promise.all([listNetworkNodes(), listNetworkConnections()])
    syncFlow()
  }

  // Undo/Redo läuft serverseitig auf einem einzigen globalen Netzwerk-Stack
  // (kein Show-Bezug) — dieselbe Mechanik wie bei Shows, nur andere Endpunkte.
  // Nach Undo/Redo lädt die Ansicht die Daten neu, da der Server sie nur ändert.
  const {
    undo: undoRaw, redo: redoRaw, canUndo, canRedo, onUndoRedoKeydown,
  } = useServerUndoRedo({
    undo: undoNetwork,
    redo: redoNetwork,
    onAfter: reloadNetwork,
    // Undo/Redo selbst war erfolgreich — nur das Nachladen ist gescheitert.
    // Eigene Meldung statt error.save_failed, das wäre hier irreführend.
    onAfterError: (e) => {
      networkError.value = t('error.reload_failed')
      console.error('[useNetworkGraph] Nachladen nach Undo/Redo fehlgeschlagen:', e)
    },
  })
  const undo = () => undoRaw().catch(reportNetworkError)
  const redo = () => redoRaw().catch(reportNetworkError)

  // Ein Port per Dropdown auf "Frei" zu setzen, ist die reguläre Bedienung
  // (kein Löschen-Klick nötig) — daher ohne Bestätigungsdialog.
  async function deleteConnectionSilently(conn: NetworkConnection) {
    clearNetworkError()
    try {
      await deleteNetworkConnection(conn.id)
      connections.value = connections.value.filter(c => c.id !== conn.id)
      syncFlow()
    } catch (e) {
      reportNetworkError(e)
      syncFlow() // Vue Flow hat die Kante lokal (edges-change) schon entfernt — zurücksynchronisieren
    }
  }

  // Legt eine Verbindung an und meldet Fehler, statt sie unbehandelt zu lassen.
  // Gibt bei Erfolg die neue Verbindung zurück, sonst null.
  async function createConnection(data: Partial<NetworkConnection>) {
    clearNetworkError()
    try {
      const conn = await createNetworkConnection(data)
      connections.value.push(conn)
      syncFlow()
      return conn
    } catch (e) {
      reportNetworkError(e)
      return null
    }
  }

  async function saveConnection(conn: NetworkConnection, patch: Partial<NetworkConnection>) {
    clearNetworkError()
    const before = { ...conn }
    Object.assign(conn, patch)
    try {
      await updateNetworkConnection(conn.id, conn)
      syncFlow()
    } catch (e) {
      Object.assign(conn, before)
      syncFlow()
      reportNetworkError(e)
    }
  }

  function connFieldForNode(conn: NetworkConnection, nodeId: string) {
    if (conn.from_node_id === nodeId) return 'from'
    if (conn.to_node_id === nodeId) return 'to'
    return null
  }
  function portConnection(switchId: string, port: number | string) {
    return connections.value.find(c => {
      const field = connFieldForNode(c, switchId)
      if (!field) return false
      return String(field === 'from' ? c.from_port : c.to_port) === String(port)
    })
  }

  async function setPortTarget(sw: NetworkNode, port: number | string, targetNodeId: string | null) {
    const existing = portConnection(sw.id, port)
    if (!targetNodeId) {
      if (existing) await deleteConnectionSilently(existing)
      return
    }
    const ok = await claimNodeSlot(targetNodeId, existing?.id ?? null)
    if (!ok) return
    if (existing) {
      const field = connFieldForNode(existing, sw.id)
      const patch = field === 'from' ? { to_node_id: targetNodeId, to_port: '' } : { from_node_id: targetNodeId, from_port: '' }
      await saveConnection(existing, patch)
    } else {
      await createConnection({ from_node_id: sw.id, from_port: String(port), to_node_id: targetNodeId, to_port: '', cable_type: '' })
    }
  }
  async function setPortTargetPort(conn: NetworkConnection, switchId: string, value: string) {
    const field = connFieldForNode(conn, switchId)
    await saveConnection(conn, field === 'from' ? { to_port: value } : { from_port: value })
  }

  // Eine Netzwerkdose/ein Gerät hat nur ein Kabel, kann also nur eine
  // Verbindung haben — ein Switch ist die Ausnahme (viele Ports, viele
  // Verbindungen). Ist das Element schon anderweitig verbunden, wird
  // nachgefragt, ob die alte Verbindung ersetzt werden soll; bei Ablehnung
  // bricht der Aufrufer die ganze Aktion ab.
  async function claimNodeSlot(nodeId: string, excludeConnId: string | null) {
    const node = nodesById.value.get(nodeId)
    if (!node || node.type === 'switch') return true
    const max = maxConnectionsForType(node.type)
    const existing = connections.value.filter(c => c.id !== excludeConnId && (c.from_node_id === nodeId || c.to_node_id === nodeId))
    if (existing.length < max) return true
    const oldest = [...existing].sort((a, b) => a.created_at - b.created_at)[0]
    const ok = await confirm({
      t, titleKey: 'network.reconnect.confirm_title',
      messageKey: 'network.reconnect.confirm_message', messageParams: { label: connectionLabel(nodeId) },
      confirmKey: 'network.reconnect.confirm_action', cancelKey: 'action.cancel',
    })
    if (!ok) return false
    await deleteConnectionSilently(oldest)
    return true
  }

  async function createNode(type: string) {
    clearNetworkError()
    try {
      const node = await createNetworkNode({ type, label: '', room: '', port_count: null, is_main: 0 })
      nodes.value.push(node)
      syncFlow()
      return node
    } catch (e) {
      reportNetworkError(e)
      return null
    }
  }

  async function updateNode(node: NetworkNode, patch: Partial<NetworkNode>) {
    clearNetworkError()
    const before = { ...node }
    Object.assign(node, patch)
    try {
      await updateNetworkNode(node.id, node)
      syncFlow()
    } catch (e) {
      Object.assign(node, before)
      syncFlow()
      reportNetworkError(e)
    }
  }

  async function deleteNodeSilently(node: NetworkNode) {
    clearNetworkError()
    try {
      await deleteNetworkNode(node.id)
      nodes.value = nodes.value.filter(n => n.id !== node.id)
      connections.value = connections.value.filter(c => c.from_node_id !== node.id && c.to_node_id !== node.id)
      syncFlow()
    } catch (e) {
      reportNetworkError(e)
      syncFlow() // Vue Flow hat den Knoten lokal (nodes-change) schon entfernt — zurücksynchronisieren
    }
  }
  async function removeNode(node: NetworkNode) {
    const affected = connections.value.filter(c => c.from_node_id === node.id || c.to_node_id === node.id).length
    const ok = affected
      ? await confirm({ t, titleKey: 'action.delete', messageKey: 'network.delete_element.confirm', messageParams: { count: affected }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
      : await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
    if (!ok) return
    await deleteNodeSilently(node)
  }
  async function removeConnection(conn: NetworkConnection) {
    const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
    if (!ok) return
    await deleteConnectionSilently(conn)
  }

  // "Sonstige Verbindungen"-Tabelle: eine Seite einer bestehenden Verbindung
  // per Dropdown auf ein anderes Element umstellen — mit demselben
  // Belegt-Check wie beim Neuanlegen (das neue Element könnte schon woanders
  // verbunden sein).
  async function updateConnectionEndpoint(conn: NetworkConnection, side: 'from' | 'to', newNodeId: string) {
    const otherId = side === 'from' ? conn.to_node_id : conn.from_node_id
    const newNode = nodesById.value.get(newNodeId)
    const otherNode = nodesById.value.get(otherId)
    if (!newNode || !otherNode) return
    if (!isValidConnectionPair(newNode.type, otherNode.type)) return
    if (!(await claimNodeSlot(newNodeId, conn.id))) return
    await saveConnection(conn, side === 'from' ? { from_node_id: newNodeId } : { to_node_id: newNodeId })
  }

  // "Verbindung hinzufügen" landet in "Sonstige Verbindungen" als leerer
  // Entwurf — from_node_id/to_node_id sind in der DB NOT NULL mit
  // Fremdschlüssel, ein echter Datensatz kann also nicht ohne gewählte
  // Elemente existieren. Erst wenn beide gewählt sind, wird gespeichert.
  const pendingConnections = ref<PendingConnection[]>([])
  let pendingConnectionCounter = 0
  function addPendingConnection() {
    pendingConnections.value.push({ id: `pending-${++pendingConnectionCounter}`, from_node_id: '', to_node_id: '' })
  }
  async function commitPendingConnection(draft: PendingConnection, patch: Partial<PendingConnection>) {
    Object.assign(draft, patch)
    if (!draft.from_node_id || !draft.to_node_id) return
    if (!(await claimNodeSlot(draft.from_node_id, null))) return
    if (!(await claimNodeSlot(draft.to_node_id, null))) return
    const conn = await createConnection({ from_node_id: draft.from_node_id, from_port: '', to_node_id: draft.to_node_id, to_port: '', cable_type: '' })
    if (!conn) return
    pendingConnections.value = pendingConnections.value.filter(d => d.id !== draft.id)
  }
  function removePendingConnection(draft: PendingConnection) {
    pendingConnections.value = pendingConnections.value.filter(d => d.id !== draft.id)
  }

  // Speichert die aktuellen Positionen als Snapshot, den man später per Klick
  // wiederherstellen kann — unabhängig von der laufenden Auto-Speicherung
  // beim Verschieben einzelner Elemente.
  async function saveLayout() {
    clearNetworkError()
    const data: Record<string, { x: number, y: number }> = {}
    for (const n of nodes.value) {
      if (n.position_x != null && n.position_y != null) data[n.id] = { x: n.position_x, y: n.position_y }
    }
    try {
      await saveNetworkLayoutSnapshot(data)
      hasSavedLayout.value = true
    } catch (e) {
      reportNetworkError(e)
    }
  }

  async function restoreLayout() {
    clearNetworkError()
    let snapshot
    try {
      snapshot = await getNetworkLayoutSnapshot()
    } catch (e) {
      reportNetworkError(e)
      return
    }
    if (!snapshot) return

    const updates: { node: NetworkNode, before: { x: number | null, y: number | null } }[] = []
    for (const n of nodes.value) {
      const pos = snapshot.data[n.id]
      if (!pos) continue
      updates.push({ node: n, before: { x: n.position_x, y: n.position_y } })
      n.position_x = pos.x
      n.position_y = pos.y
    }
    syncFlow()

    const results = await Promise.allSettled(updates.map(u => updateNetworkNode(u.node.id, u.node)))
    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length) {
      results.forEach((r, i) => { if (r.status === 'rejected') Object.assign(updates[i].node, updates[i].before) })
      syncFlow()
      reportNetworkError(failed[0].reason)
    }
  }

  async function loadInitial() {
    acquireOnOpen().catch(() => {})
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
  }

  onUnmounted(() => { releaseOnClose() })

  return {
    loading, nodes, connections, networkError, hasSavedLayout,
    lock, isLockedByOther,
    reportNetworkError, clearNetworkError,
    nodesById, connectionLabel,
    undo, redo, canUndo, canRedo, onUndoRedoKeydown,
    loadInitial, reloadNetwork,
    createNode, updateNode, deleteNodeSilently, removeNode,
    createConnection, saveConnection, deleteConnectionSilently, removeConnection, updateConnectionEndpoint,
    setPortTarget, setPortTargetPort, connFieldForNode, portConnection,
    claimNodeSlot,
    pendingConnections, addPendingConnection, commitPendingConnection, removePendingConnection,
    saveLayout, restoreLayout,
  }
}

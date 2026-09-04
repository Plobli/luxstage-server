import { api } from './client'

export interface NetworkNode {
  id: string
  type: string
  label: string
  room: string
  port_count: number | null
  position_x: number | null
  position_y: number | null
  is_main: number
  created_at: number
}

export interface NetworkConnection {
  id: string
  from_node_id: string
  from_port: string
  to_node_id: string
  to_port: string
  cable_type: string
  created_at: number
}

export const listNetworkNodes = (): Promise<NetworkNode[]> => api.get('/api/network/nodes')
export const createNetworkNode = (data: Partial<NetworkNode>): Promise<NetworkNode> => api.post('/api/network/nodes', data)
export const updateNetworkNode = (id: string, data: Partial<NetworkNode>): Promise<NetworkNode> => api.put(`/api/network/nodes/${id}`, data)
export const deleteNetworkNode = (id: string): Promise<void> => api.delete(`/api/network/nodes/${id}`)

export const listNetworkConnections = (): Promise<NetworkConnection[]> => api.get('/api/network/connections')
export const createNetworkConnection = (data: Partial<NetworkConnection>): Promise<NetworkConnection> => api.post('/api/network/connections', data)
export const updateNetworkConnection = (id: string, data: Partial<NetworkConnection>): Promise<NetworkConnection> => api.put(`/api/network/connections/${id}`, data)
export const deleteNetworkConnection = (id: string): Promise<void> => api.delete(`/api/network/connections/${id}`)

export interface NetworkLayoutSnapshot {
  data: Record<string, { x: number, y: number }>
  updated_at: number
}

export const getNetworkLayoutSnapshot = (): Promise<NetworkLayoutSnapshot | null> => api.get('/api/network/layout-snapshot')
export const saveNetworkLayoutSnapshot = (data: Record<string, { x: number, y: number }>): Promise<NetworkLayoutSnapshot> => api.put('/api/network/layout-snapshot', data)

export const undoNetwork = (): Promise<{ ok: true }> => api.post('/api/network/undo', {})
export const redoNetwork = (): Promise<{ ok: true }> => api.post('/api/network/redo', {})

export interface NetworkLockResult { ok: boolean, lockedBy?: string, since?: number }
export const acquireNetworkLock = (): Promise<NetworkLockResult> => api.post('/api/network/lock', {})
export const releaseNetworkLock = (): Promise<{ ok: true }> => api.delete('/api/network/lock')
export const touchNetworkLock = (): Promise<{ ok: true }> => api.put('/api/network/lock', {})

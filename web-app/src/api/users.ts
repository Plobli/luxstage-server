import { api } from './client'

export function listUsers(): Promise<any[]> { return api.get('/api/users') }
export function createUser(username: string): Promise<any> { return api.post('/api/users', { username }) }
export function deleteUser(username: string): Promise<any> { return api.delete(`/api/users/${encodeURIComponent(username)}`) }
export function approveUser(username: string): Promise<any> { return api.post(`/api/users/${encodeURIComponent(username)}/approve`, {}) }

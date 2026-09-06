import { api } from './client'

/** GET /api/users (server/routes/users.js:49, listUsers() in server/db/users.js). */
export interface UserSummary {
  username: string;
  email: string;
  pending: boolean;
  source: 'db';
}

export function listUsers(): Promise<UserSummary[]> { return api.get('/api/users') }
export function createUser(username: string): Promise<{ ok: true }> { return api.post('/api/users', { username }) }
export function deleteUser(username: string): Promise<{ ok: true }> { return api.delete(`/api/users/${encodeURIComponent(username)}`) }
export function approveUser(username: string): Promise<{ ok: true }> { return api.post(`/api/users/${encodeURIComponent(username)}/approve`, {}) }

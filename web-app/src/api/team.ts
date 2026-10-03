import { api } from './client'

/** GET /api/auth/team-status (server/routes/auth.js). */
export interface TeamStatus {
  state: 'trial' | 'active' | 'readonly';
  accessUntil: number | null;
  owner: boolean;
  ownerUsername: string | null;
  /** Abrechnung (Stripe) aktiv? Aus: kein Ablauf, kein Abrechnungsbereich. */
  billingEnabled: boolean;
}

export function getTeamStatus(): Promise<TeamStatus> { return api.get('/api/auth/team-status') }
export function transferTeamOwner(username: string): Promise<{ ok: true; ownerUsername: string }> {
  return api.post('/api/auth/team-owner', { username })
}

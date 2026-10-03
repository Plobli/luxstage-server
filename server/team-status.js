// LuxStage/server/team-status.js
// Zugangsstatus eines Teams aus Testzeitraum und bezahltem Zeitraum.
//
//   trial / active -> voller Zugang
//   readonly       -> nach Ablauf dauerhaft nur lesen und exportieren (nie sperren, nie löschen)
//
// Zugang endet am späteren der beiden Daten (trial_ends_at, paid_until). Fehlen beide
// (Bestandsteams), gibt es keinen Ablauf.
export const TRIAL_DAYS = 14

// tenant: { trial_ends_at, paid_until } (ms oder null). Fehlt der Eintrag ganz, gilt voller Zugang.
export function computeTeamStatus(tenant, nowMs = Date.now()) {
  if (!tenant) return { state: 'active', accessUntil: null }
  const trialEnd = tenant.trial_ends_at ?? 0
  const paidUntil = tenant.paid_until ?? 0
  const accessUntil = Math.max(trialEnd, paidUntil)
  if (!accessUntil) return { state: 'active', accessUntil: null }
  if (nowMs <= accessUntil) return { state: paidUntil >= nowMs ? 'active' : 'trial', accessUntil }
  return { state: 'readonly', accessUntil }
}

// Darf dieser Request im gegebenen Zustand ausgeführt werden?
// Gibt null (erlaubt) oder { code, error } zurück.
export function teamAccessDenial(status, method, pathname) {
  if (status.state !== 'readonly') return null
  const read = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
  const loginPath = pathname === '/api/auth/login' || pathname === '/api/auth/validate'
  if (read || loginPath) return null
  return { code: 'TEAM_READONLY', error: 'Dieses Team ist nur noch lesbar (Export weiterhin möglich)' }
}

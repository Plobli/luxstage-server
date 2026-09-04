import { api, request, setToken, clearToken, ApiError } from './client'

export async function login(username: string, password: string): Promise<{ requiresPasswordChange: boolean }> {
  const { token, requiresPasswordChange } = await request<{ token: string, requiresPasswordChange: boolean }>('POST', '/api/auth/login', {
    body: { username, password },
    authenticated: false,
  })
  setToken(token)
  return { requiresPasswordChange: !!requiresPasswordChange }
}

/** true, wenn der Fehler bedeutet, dass ein Login-Versuch auf ein noch nicht freigeschaltetes Konto trifft. */
export function isPendingApprovalError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403 && e.body?.error === 'pending'
}

/** Selbst-Registrierung innerhalb eines bestehenden Tenants — Konto bleibt pending bis Freischaltung. */
export async function selfRegister(email: string, password: string): Promise<void> {
  await request('POST', '/api/self-register', { body: { email, password }, authenticated: false })
}

/** SaaS-Registrierung: legt eine unbestätigte Anmeldung an, Server verschickt Opt-In-Mail. */
export async function register(teamId: string, email: string, password: string): Promise<void> {
  await request('POST', '/api/register', { body: { teamId, email, password }, authenticated: false })
}

/** Fordert einen Passwort-Reset-Link an (neutrale Antwort, kein Existenz-Leak). */
export async function requestPasswordReset(email: string): Promise<void> {
  await request('POST', '/api/auth/forgot-password', { body: { email }, authenticated: false })
}

/** Setzt ein neues Passwort mit dem Reset-Token aus der Mail. */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await request('POST', '/api/auth/reset-password/confirm', { body: { token, newPassword }, authenticated: false })
}

/** Bestätigt die Registrierung über den Token aus der Opt-In-Mail. */
export async function confirmRegistration(token: string): Promise<{ tenantId: string, loginUrl: string }> {
  return request('GET', '/api/register/confirm?token=' + encodeURIComponent(token), { authenticated: false })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<any> {
  return api.post('/api/auth/change-password', { currentPassword, newPassword })
}

export async function logout(): Promise<void> { clearToken() }

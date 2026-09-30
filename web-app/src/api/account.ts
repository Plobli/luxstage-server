import { api } from './client'

/** Fordert die Löschung des eigenen Teams an (nur SaaS) — Server prüft das Passwort und benachrichtigt den Betreiber per Mail. Die Löschung selbst erfolgt manuell durch den Betreiber, nicht automatisiert. */
export async function requestTenantDelete(password: string): Promise<void> {
  await api.post('/api/tenant/delete-request', { password })
}

/** Sendet Feedback an den Betreiber (nur SaaS). */
export async function sendFeedback(text: string): Promise<void> {
  await api.post('/api/feedback', { text })
}

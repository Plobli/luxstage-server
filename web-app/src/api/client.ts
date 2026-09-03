/**
 * client.js — schlanker HTTP-Client für den LuxStage-Server
 * Ersetzt pocketbase.js
 */
import { ref } from 'vue'

/** Reaktiver Online-Status — true wenn der LuxStage-Server erreichbar ist */
export const isOnline = ref<boolean>(true)

const DEV_SERVER = import.meta.env.VITE_SERVER_URL || null
export const BASE = (): string => localStorage.getItem('server_url') || DEV_SERVER || window.location.origin
const TOKEN_KEY = 'luxstage_token'

// Kurzlebiges, wiederverwendbares Token für Inline-Ressourcen (img src) —
// im Speicher gecached und kurz vor Ablauf automatisch erneuert, damit
// mehrere gleichzeitig sichtbare Bilder dasselbe Token teilen können (anders
// als das Einmal-Download-Token) und trotzdem nicht das langlebige JWT in
// Browser-History/Proxy-Logs landet.
let inlineTokenCache: { token: string, expiresAt: number } | null = null
let inlineTokenInFlight: Promise<string> | null = null

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t: string): void { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken(): void { localStorage.removeItem(TOKEN_KEY); inlineTokenCache = null }
export function isLoggedIn(): boolean { return !!getToken() }

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly body: any = null) {
    super(message)
  }
}

type RequestOptions = {
  body?: unknown;
  authenticated?: boolean;
  contentType?: string | null;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000

function headers({ authenticated, contentType, extraHeaders }: Pick<RequestOptions, 'authenticated' | 'contentType' | 'extraHeaders'>): Record<string, string> {
  const result: Record<string, string> = { ...extraHeaders }
  if (contentType) result['Content-Type'] = contentType
  const token = getToken()
  if (authenticated && token) result['Authorization'] = 'Bearer ' + token
  return result
}

async function request<T>(method: string, path: string, {
  body,
  authenticated = true,
  contentType = 'application/json',
  extraHeaders,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RequestOptions = {}): Promise<T> {
  const hadToken = authenticated && !!getToken()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(BASE() + path, {
      method,
      headers: headers({ authenticated, contentType, extraHeaders }),
      body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body as BodyInit,
      signal: controller.signal,
    })
  } catch (e) {
    isOnline.value = false
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
  isOnline.value = true
  if (res.status === 401) {
    clearToken()
    if (hadToken && location.pathname !== '/login') location.href = '/login'
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new ApiError(err.error || `HTTP ${res.status}`, res.status, err)
  }
  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

const INLINE_TOKEN_REFRESH_MARGIN_MS = 60 * 1000

async function getInlineToken(): Promise<string> {
  if (inlineTokenCache && inlineTokenCache.expiresAt - INLINE_TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return inlineTokenCache.token
  }
  // Mehrere gleichzeitig sichtbare Bilder (Fotos, Grundriss) rufen api.url()
  // parallel auf — ohne Dedupe würde jedes einen eigenen Token-Request auslösen.
  if (inlineTokenInFlight) return inlineTokenInFlight
  inlineTokenInFlight = request<{ token: string, expiresAt: number }>('POST', '/api/auth/inline-token')
    .then(({ token, expiresAt }) => {
      inlineTokenCache = { token, expiresAt }
      return token
    })
    .finally(() => { inlineTokenInFlight = null })
  return inlineTokenInFlight
}

export const api = {
  get: <T = unknown>(path: string) => request<T>('GET', path),
  post: <T = unknown>(path: string, body: unknown) => request<T>('POST', path, { body }),
  put: <T = unknown>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  patch: <T = unknown>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T = unknown>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  /** Größeres Timeout als der Default — für Datei-Uploads (Backup-Restore),
   *  ein einheitlicher globaler Wert würde große Uploads künstlich abbrechen. */
  send: <T = unknown>(method: string, path: string, body: BodyInit, contentType: string) =>
    request<T>(method, path, { body, contentType, timeoutMs: 5 * 60_000 }),

  /** URL mit kurzlebigem, wiederverwendbarem Token (15 Min TTL) für Inline-
   *  Ressourcen (img src). Für einmalige Downloads (PDF, Backup) stattdessen
   *  downloadUrl() nutzen. */
  url: async (path: string): Promise<string> => {
    const token = await getInlineToken()
    return BASE() + path + (path.includes('?') ? '&' : '?') + 'token=' + token
  },

  /** Async URL mit kurzlebigem Einmal-Token (60s TTL) für Downloads (PDF, Backup).
   *  Verhindert, dass der langlebige JWT in Server-Logs landet. */
  downloadUrl: async (path: string): Promise<string> => {
    const { token } = await request<{ token: string }>('POST', '/api/auth/download-token')
    return BASE() + path + (path.includes('?') ? '&' : '?') + 'token=' + token
  },
}

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

export function approveUser(username: string): Promise<any> { return api.post(`/api/users/${encodeURIComponent(username)}/approve`, {}) }

export async function logout(): Promise<void> { clearToken() }

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

export function listUsers(): Promise<any[]> { return api.get('/api/users') }
export function createUser(username: string): Promise<any> { return api.post('/api/users', { username }) }
export function deleteUser(username: string): Promise<any> { return api.delete(`/api/users/${username}`) }

export function getSmtpConfig(): Promise<any> { return api.get('/api/smtp') }
export function saveSmtpConfig(cfg: object): Promise<any> { return api.post('/api/smtp', cfg) }
export function testSmtpConfig(to: string): Promise<any> { return api.post('/api/smtp/test', { to }) }

export function setServerUrl(url: string): void {
  localStorage.setItem('server_url', url.replace(/\/$/, ''))
}

export interface ShowPresenceUser {
  username: string;
  /** Geräte desselben Nutzers, z.B. ['web', 'ios']. */
  devices: string[];
  lastActivityAt: string;
}

/**
 * SSE-Verbindung pro Show: Lock-Status/Übernahme-Anfragen (Single-Editor-Sperre)
 * und Präsenz (wer die Show gerade offen hat). Gibt eine Unsubscribe-Funktion zurück.
 * Nutzt pro Verbindungsversuch ein frisches kurzlebiges Einmal-Token (statt
 * des langlebigen JWT), damit kein Dauer-Token in Server-/Proxy-Logs landet.
 * EventSource kann bei einem Einmal-Token nicht selbst reconnecten (das Token
 * ist nach dem ersten Connect verbraucht) — der Reconnect wird daher hier
 * manuell mit neuem Token durchgeführt.
 */
export function subscribeShow(showId: string, { onLockStatus, onTakeoverRequested, onPresence }: {
  onLockStatus?: (data: any) => void,
  onTakeoverRequested?: (data: any) => void,
  onPresence?: (data: { users: ShowPresenceUser[] }) => void,
} = {}): () => void {
  let es: EventSource | null = null
  let closed = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0

  // Exponentiell mit Obergrenze + Jitter statt fixem Delay — verhindert, dass
  // bei einem längeren Serverausfall (z.B. während des Selbst-Update-Neustarts)
  // jeder offene Tab jeder Show alle 3s unvermindert weiter reconnectet und den
  // gerade erst wieder hochgefahrenen Server zusätzlich belastet.
  function nextDelay(): number {
    const base = Math.min(3000 * 2 ** attempt, 30_000)
    return base / 2 + Math.random() * (base / 2)
  }

  async function connect(): Promise<void> {
    if (closed) return
    let url: string
    try {
      url = await api.downloadUrl(`/api/shows/${showId}/events?device=web`)
    } catch {
      if (!closed) { retryTimer = setTimeout(connect, nextDelay()); attempt++ }
      return
    }
    if (closed) return

    es = new EventSource(url)
    if (onLockStatus) es.addEventListener('lock-status-updated', (e: any) => onLockStatus(JSON.parse(e.data)))
    if (onTakeoverRequested) es.addEventListener('lock-takeover-requested', (e: any) => onTakeoverRequested(JSON.parse(e.data)))
    if (onPresence) es.addEventListener('presence-updated', (e: any) => onPresence(JSON.parse(e.data)))
    es.onopen = () => { attempt = 0 }
    es.onerror = () => {
      es?.close()
      es = null
      if (!closed) { retryTimer = setTimeout(connect, nextDelay()); attempt++ }
    }
  }

  connect()

  return () => {
    closed = true
    if (retryTimer) clearTimeout(retryTimer)
    es?.close()
  }
}



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
}

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
}: RequestOptions = {}): Promise<T> {
  const hadToken = authenticated && !!getToken()
  let res: Response
  try {
    res = await fetch(BASE() + path, {
      method,
      headers: headers({ authenticated, contentType, extraHeaders }),
      body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body as BodyInit,
    })
  } catch (e) {
    isOnline.value = false
    throw e
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
  send: <T = unknown>(method: string, path: string, body: BodyInit, contentType: string) =>
    request<T>(method, path, { body, contentType }),

  /** GET, das auch Response-Header zurückgibt (z.B. X-Show-Version) —
   *  request<T>() gibt nur den geparsten Body zurück. */
  getWithHeaders: async <T = unknown>(path: string): Promise<{ data: T, headers: Headers }> => {
    const res = await fetch(BASE() + path, { headers: headers({ authenticated: true, contentType: null }) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new ApiError(err.error || `HTTP ${res.status}`, res.status, err)
    }
    return { data: await res.json(), headers: res.headers }
  },

  /** PUT mit optimistischer Konflikterkennung: baseVersion geht als If-Match-
   *  Header mit, die neue Version kommt per X-Show-Version zurück. Weicht
   *  baseVersion vom Serverstand ab, wirft dies eine ApiError mit status 409
   *  und body.serverVersion/body.serverChannels. */
  putWithVersion: async <T = unknown>(path: string, body: unknown, baseVersion: string | null): Promise<{ data: T, version: string | null }> => {
    const res = await fetch(BASE() + path, {
      method: 'PUT',
      headers: headers({ authenticated: true, contentType: 'application/json', extraHeaders: baseVersion ? { 'If-Match': baseVersion } : undefined }),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new ApiError(err.error || `HTTP ${res.status}`, res.status, err)
    }
    return { data: await res.json(), version: res.headers.get('X-Show-Version') }
  },

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
export function createUser(username: string, role: string): Promise<any> { return api.post('/api/users', { username, role }) }
export function deleteUser(username: string): Promise<any> { return api.delete(`/api/users/${username}`) }

export function getSmtpConfig(): Promise<any> { return api.get('/api/smtp') }
export function saveSmtpConfig(cfg: object): Promise<any> { return api.post('/api/smtp', cfg) }
export function testSmtpConfig(to: string): Promise<any> { return api.post('/api/smtp/test', { to }) }

export async function resetPassword(username: string): Promise<any> {
  return api.post('/api/auth/reset-password', { username })
}

export function setServerUrl(url: string): void {
  localStorage.setItem('server_url', url.replace(/\/$/, ''))
}

/**
 * SSE-Verbindung pro Show, ausschließlich für Lock-Status/Übernahme-Anfragen
 * (Single-Editor-Sperre). Gibt eine Unsubscribe-Funktion zurück.
 * Nutzt pro Verbindungsversuch ein frisches kurzlebiges Einmal-Token (statt
 * des langlebigen JWT), damit kein Dauer-Token in Server-/Proxy-Logs landet.
 * EventSource kann bei einem Einmal-Token nicht selbst reconnecten (das Token
 * ist nach dem ersten Connect verbraucht) — der Reconnect wird daher hier
 * manuell mit neuem Token durchgeführt.
 */
export function subscribeShow(showId: string, { onLockStatus, onTakeoverRequested }: { onLockStatus?: (data: any) => void, onTakeoverRequested?: (data: any) => void } = {}): () => void {
  let es: EventSource | null = null
  let closed = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  async function connect(): Promise<void> {
    if (closed) return
    let url: string
    try {
      url = await api.downloadUrl(`/api/shows/${showId}/events?device=web`)
    } catch {
      if (!closed) retryTimer = setTimeout(connect, 3000)
      return
    }
    if (closed) return

    es = new EventSource(url)
    if (onLockStatus) es.addEventListener('lock-status-updated', (e: any) => onLockStatus(JSON.parse(e.data)))
    if (onTakeoverRequested) es.addEventListener('lock-takeover-requested', (e: any) => onTakeoverRequested(JSON.parse(e.data)))
    es.onerror = () => {
      es?.close()
      es = null
      if (!closed) retryTimer = setTimeout(connect, 3000)
    }
  }

  connect()

  return () => {
    closed = true
    if (retryTimer) clearTimeout(retryTimer)
    es?.close()
  }
}



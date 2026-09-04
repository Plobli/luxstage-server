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

export async function request<T>(method: string, path: string, {
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

export function setServerUrl(url: string): void {
  localStorage.setItem('server_url', url.replace(/\/$/, ''))
}


import { describe, test, expect, vi, beforeEach } from 'vitest'

// client.ts läuft normalerweise im Browser (fetch/localStorage/location) und wird von 30
// Frontend-Dateien importiert (siehe architecture-analysis-2026-09-03.md, F-04) — dieser Test
// deckt gezielt das ApiError-Mapping ab, das sonst nur indirekt über gemockte Aufrufer wie
// shows.test.ts mitläuft. Stubt nur das Minimum an globalem Browser-API statt jsdom als neue
// Abhängigkeit einzuführen (im Projekt bislang nicht vorhanden).

const store = new Map<string, string>()
const fakeLocation = { pathname: '/shows', href: '', origin: 'http://test.local' }
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
})
vi.stubGlobal('location', fakeLocation)
vi.stubGlobal('window', { location: fakeLocation })

const { api, ApiError, setToken, getToken } = await import('./client')

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  store.clear()
  fakeLocation.pathname = '/shows'
  fakeLocation.href = ''
})

describe('ApiError-Mapping', () => {
  test('ein Fehlerstatus mit JSON-Body wirft ApiError mit dessen error-Feld als Message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(423, { error: 'Show gesperrt', lockedBy: 'anna' })))
    await expect(api.get('/api/shows/x')).rejects.toMatchObject({
      status: 423,
      message: 'Show gesperrt',
      body: { error: 'Show gesperrt', lockedBy: 'anna' },
    })
  })

  test('ein Fehlerstatus ohne (parsbaren) JSON-Body fällt auf "HTTP <status>" zurück', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('kaputt', { status: 500 })))
    await expect(api.get('/api/x')).rejects.toMatchObject({ status: 500, message: 'HTTP 500' })
  })

  test('die geworfene Ausnahme ist eine echte ApiError-Instanz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { error: 'Nicht gefunden' })))
    await expect(api.get('/api/x')).rejects.toBeInstanceOf(ApiError)
  })

  test('ein Erfolgsstatus wirft nicht, auch nicht bei leerem 204-Body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(api.get('/api/x')).resolves.toBeNull()
  })

  test('401 löscht das gespeicherte Token und leitet auf /login um', async () => {
    setToken('abc')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Nicht angemeldet' })))
    await expect(api.get('/api/x')).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBeNull()
    expect(fakeLocation.href).toBe('/login')
  })

  test('401 ohne vorheriges Token leitet nicht um (kein abgelaufener Login-Zustand)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Nicht angemeldet' })))
    await expect(api.get('/api/x')).rejects.toMatchObject({ status: 401 })
    expect(fakeLocation.href).toBe('')
  })
})

// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { setToken, clearToken, getToken, BASE } from '../api/client'

const { useTokenRefresh } = await import('./useTokenRefresh')

function makeToken(expInSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'none' }))
  const payload = btoa(JSON.stringify({ username: 'anna', exp: Math.floor(Date.now() / 1000) + expInSeconds }))
  return `${header}.${payload}.sig`
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function mountWithRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }, { path: '/login', component: { render: () => null } }] })
  const pushSpy = vi.spyOn(router, 'push')
  const host = defineComponent({
    setup() {
      useTokenRefresh()
      return () => h('div')
    },
  })
  const app = createApp(host)
  app.use(router)
  const el = document.createElement('div')
  app.mount(el)
  return { app, router, pushSpy }
}

beforeEach(() => {
  vi.useFakeTimers()
  clearToken()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  clearToken()
})

describe('useTokenRefresh', () => {
  test('tut nichts ohne gespeichertes Token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { app } = mountWithRouter()
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    app.unmount()
  })

  test('Token mit viel Restlaufzeit wird nicht erneuert', async () => {
    setToken(makeToken(60 * 60))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { app } = mountWithRouter()
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    app.unmount()
  })

  test('Token kurz vor Ablauf wird per POST /api/auth/refresh erneuert', async () => {
    setToken(makeToken(10 * 60))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: makeToken(12 * 60 * 60) }) })
    vi.stubGlobal('fetch', fetchMock)
    const { app } = mountWithRouter()
    await flushPromises()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(BASE() + '/api/auth/refresh', expect.objectContaining({ method: 'POST' }))
    app.unmount()
  })

  test('erfolgreicher Refresh ersetzt das gespeicherte Token', async () => {
    setToken(makeToken(10 * 60))
    const newToken = makeToken(12 * 60 * 60)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: newToken }) }))
    const { app } = mountWithRouter()
    await flushPromises()
    expect(getToken()).toBe(newToken)
    app.unmount()
  })

  test('bereits abgelaufenes Token: Nutzer wird ausgeloggt und zu /login geleitet', async () => {
    setToken(makeToken(-10))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { app, pushSpy } = mountWithRouter()
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith('/login')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getToken()).toBeNull()
    app.unmount()
  })

  test('401 beim Refresh loggt aus und leitet zu /login', async () => {
    setToken(makeToken(10 * 60))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const { app, pushSpy } = mountWithRouter()
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith('/login')
    expect(getToken()).toBeNull()
    app.unmount()
  })

  test('Netzwerkfehler beim Refresh wird still ignoriert', async () => {
    setToken(makeToken(10 * 60))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { app } = mountWithRouter()
    await flushPromises()
    app.unmount()
  })

  test('nach unmount wird kein Redirect mehr ausgelöst (Unmount-Guard)', async () => {
    // Token noch knapp gültig, aber unter der Refresh-Schwelle: tryRefresh hängt
    // im nie auflösenden fetch(), während die Komponente unmountet wird.
    setToken(makeToken(10 * 60))
    let resolveFetch: ((v: any) => void) | undefined
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveFetch = resolve })))
    const { app, pushSpy } = mountWithRouter()
    await flushPromises()
    app.unmount()
    resolveFetch?.({ ok: false, status: 401 })
    await flushPromises()
    expect(pushSpy).not.toHaveBeenCalled()
  })

  test('prüft periodisch alle 5 Minuten erneut', async () => {
    setToken(makeToken(60 * 60))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: makeToken(60 * 60) }) })
    vi.stubGlobal('fetch', fetchMock)
    const { app } = mountWithRouter()
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()

    // 40 Minuten später: Restlaufzeit jetzt 20 Min < 30-Min-Schwelle
    await vi.advanceTimersByTimeAsync(40 * 60 * 1000)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    app.unmount()
  })
})

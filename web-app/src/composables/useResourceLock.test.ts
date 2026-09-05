import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../api/client'

let username: string | null = 'anna'
vi.mock('../api/currentUser', () => ({
  currentUsername: () => username,
}))

const { useResourceLock } = await import('./useResourceLock')

function fakeApi() {
  return {
    acquire: vi.fn().mockResolvedValue({ ok: true }),
    release: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(undefined),
  }
}

beforeEach(() => {
  username = 'anna'
  vi.useRealTimers()
})

describe('useResourceLock', () => {
  test('startet ohne Lock', () => {
    const r = useResourceLock(fakeApi())
    expect(r.lock.value).toBeNull()
    expect(r.isHeldByMe.value).toBe(false)
    expect(r.isLockedByOther.value).toBe(false)
  })

  test('acquireOnOpen bei Erfolg markiert den Lock als eigenen', async () => {
    const api = fakeApi()
    const r = useResourceLock(api)
    await r.acquireOnOpen()
    expect(api.acquire).toHaveBeenCalledTimes(1)
    expect(r.isHeldByMe.value).toBe(true)
    expect(r.isLockedByOther.value).toBe(false)
  })

  test('acquireOnOpen bei 423 übernimmt den fremden Lock-Stand statt zu werfen', async () => {
    const api = fakeApi()
    api.acquire.mockRejectedValue(new ApiError('HTTP 423', 423, { lockedBy: 'bea', since: 42 }))
    const r = useResourceLock(api)
    await r.acquireOnOpen()
    expect(r.lock.value).toEqual({ user: 'bea', since: 42 })
    expect(r.isHeldByMe.value).toBe(false)
    expect(r.isLockedByOther.value).toBe(true)
  })

  test('acquireOnOpen reicht unerwartete Fehler durch', async () => {
    const api = fakeApi()
    api.acquire.mockRejectedValue(new Error('netz kaputt'))
    const r = useResourceLock(api)
    await expect(r.acquireOnOpen()).rejects.toThrow('netz kaputt')
  })

  test('releaseOnClose gibt den Lock frei, wenn er mir gehört', async () => {
    const api = fakeApi()
    const r = useResourceLock(api)
    await r.acquireOnOpen()
    await r.releaseOnClose()
    expect(api.release).toHaveBeenCalledTimes(1)
  })

  test('releaseOnClose ruft api.release nicht auf, wenn der Lock einem anderen gehört', async () => {
    const api = fakeApi()
    api.acquire.mockRejectedValue(new ApiError('HTTP 423', 423, { lockedBy: 'bea', since: 1 }))
    const r = useResourceLock(api)
    await r.acquireOnOpen()
    await r.releaseOnClose()
    expect(api.release).not.toHaveBeenCalled()
  })

  test('releaseOnClose schluckt einen Fehler von api.release (best effort)', async () => {
    const api = fakeApi()
    api.release.mockRejectedValue(new Error('timeout'))
    const r = useResourceLock(api)
    await r.acquireOnOpen()
    await expect(r.releaseOnClose()).resolves.toBeUndefined()
  })

  test('syncLockFromConflict übernimmt den Lock-Stand aus einer 423-Antwort', () => {
    const r = useResourceLock(fakeApi())
    r.syncLockFromConflict({ lockedBy: 'carla', since: 99 })
    expect(r.lock.value).toEqual({ user: 'carla', since: 99 })
    expect(r.isLockedByOther.value).toBe(true)
  })

  test('syncLockFromConflict ignoriert eine Antwort ohne lockedBy', () => {
    const r = useResourceLock(fakeApi())
    r.syncLockFromConflict({})
    expect(r.lock.value).toBeNull()
  })

  test('Heartbeat ruft touch periodisch auf, solange der Lock mir gehört', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    const r = useResourceLock(api)
    await r.acquireOnOpen()

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    expect(api.touch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    expect(api.touch).toHaveBeenCalledTimes(2)
  })

  test('Heartbeat übernimmt bei 423 den fremden Lock-Stand und stoppt sich selbst', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    const r = useResourceLock(api)
    await r.acquireOnOpen()

    api.touch.mockRejectedValue(new ApiError('HTTP 423', 423, { lockedBy: 'dora', since: 7 }))
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    await vi.waitFor(() => expect(r.lock.value).toEqual({ user: 'dora', since: 7 }))

    api.touch.mockClear()
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    expect(api.touch).not.toHaveBeenCalled()
  })

  test('releaseOnClose stoppt den Heartbeat, sodass touch danach nicht mehr läuft', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    const r = useResourceLock(api)
    await r.acquireOnOpen()
    await r.releaseOnClose()

    api.touch.mockClear()
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(api.touch).not.toHaveBeenCalled()
  })
})

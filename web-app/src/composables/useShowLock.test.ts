import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../api/client'

let username: string | null = 'anna'
vi.mock('../api/currentUser', () => ({
  currentUsername: () => username,
}))

const acquireShowLock = vi.fn()
const releaseShowLock = vi.fn()
const touchShowLock = vi.fn()
const requestLockTakeover = vi.fn()
const subscribeShow = vi.fn()

vi.mock('../api/shows.js', () => ({
  acquireShowLock: (...a: any[]) => acquireShowLock(...a),
  releaseShowLock: (...a: any[]) => releaseShowLock(...a),
  touchShowLock: (...a: any[]) => touchShowLock(...a),
  requestLockTakeover: (...a: any[]) => requestLockTakeover(...a),
  subscribeShow: (...a: any[]) => subscribeShow(...a),
}))

const { useShowLock } = await import('./useShowLock')

beforeEach(() => {
  username = 'anna'
  vi.useRealTimers()
  acquireShowLock.mockReset().mockResolvedValue({ ok: true })
  releaseShowLock.mockReset().mockResolvedValue({ ok: true })
  touchShowLock.mockReset().mockResolvedValue({ ok: true })
  requestLockTakeover.mockReset().mockResolvedValue({ ok: true, notified: 'bea' })
  subscribeShow.mockReset().mockReturnValue(vi.fn())
})

describe('useShowLock', () => {
  test('startet ohne Lock und ohne präsente Nutzer', () => {
    const l = useShowLock('show1')
    expect(l.lock.value).toBeNull()
    expect(l.presentUsers.value).toEqual([])
    expect(l.isHeldByMe.value).toBe(false)
  })

  test('acquireOnOpen bei Erfolg markiert den Lock als eigenen', async () => {
    const l = useShowLock('show1')
    const result = await l.acquireOnOpen()
    expect(acquireShowLock).toHaveBeenCalledWith('show1')
    expect(l.isHeldByMe.value).toBe(true)
    expect(result).toEqual({ ok: true })
  })

  test('acquireOnOpen bei 423 übernimmt den fremden Lock-Stand statt zu werfen', async () => {
    acquireShowLock.mockRejectedValue(new ApiError('HTTP 423', 423, { lockedBy: 'bea', since: 42 }))
    const l = useShowLock('show1')
    const result = await l.acquireOnOpen()
    expect(l.lock.value).toEqual({ user: 'bea', since: 42 })
    expect(l.isLockedByOther.value).toBe(true)
    expect(result).toEqual({ ok: false, lockedBy: 'bea', since: 42 })
  })

  test('acquireOnOpen reicht unerwartete Fehler durch', async () => {
    acquireShowLock.mockRejectedValue(new Error('netz kaputt'))
    const l = useShowLock('show1')
    await expect(l.acquireOnOpen()).rejects.toThrow('netz kaputt')
  })

  test('releaseOnClose gibt den Lock frei, wenn er mir gehört', async () => {
    const l = useShowLock('show1')
    await l.acquireOnOpen()
    await l.releaseOnClose()
    expect(releaseShowLock).toHaveBeenCalledWith('show1')
  })

  test('releaseOnClose ruft releaseShowLock nicht auf, wenn der Lock einem anderen gehört', async () => {
    acquireShowLock.mockRejectedValue(new ApiError('HTTP 423', 423, { lockedBy: 'bea', since: 1 }))
    const l = useShowLock('show1')
    await l.acquireOnOpen()
    await l.releaseOnClose()
    expect(releaseShowLock).not.toHaveBeenCalled()
  })

  test('requestTakeover ruft die API mit der Show-ID auf', async () => {
    const l = useShowLock('show1')
    await l.requestTakeover()
    expect(requestLockTakeover).toHaveBeenCalledWith('show1')
  })

  test('releaseForOther übergibt gezielt an den anfragenden Nutzer statt nur freizugeben', async () => {
    const l = useShowLock('show1')
    await l.acquireOnOpen()
    l.onTakeoverRequested({ requestedBy: 'carla' })
    expect(l.takeoverRequestedBy.value).toBe('carla')

    await l.releaseForOther()
    expect(releaseShowLock).toHaveBeenCalledWith('show1', 'carla')
    expect(l.takeoverRequestedBy.value).toBeNull()
  })

  test('onTakeoverRequested wird ignoriert, wenn ich den Lock nicht halte', async () => {
    const l = useShowLock('show1')
    l.onTakeoverRequested({ requestedBy: 'carla' })
    expect(l.takeoverRequestedBy.value).toBeNull()
  })

  test('dismissTakeoverRequest löscht die Anfrage ohne freizugeben', async () => {
    const l = useShowLock('show1')
    await l.acquireOnOpen()
    l.onTakeoverRequested({ requestedBy: 'carla' })
    l.dismissTakeoverRequest()
    expect(l.takeoverRequestedBy.value).toBeNull()
    expect(releaseShowLock).not.toHaveBeenCalled()
  })

  test('syncLockFromConflict übernimmt den Lock-Stand aus einer 423-Antwort', () => {
    const l = useShowLock('show1')
    l.syncLockFromConflict({ lockedBy: 'dora', since: 5 })
    expect(l.lock.value).toEqual({ user: 'dora', since: 5 })
  })

  test('onLockStatusChanged: fremder Lock wird übernommen, eigener Heartbeat gestoppt', async () => {
    vi.useFakeTimers()
    const l = useShowLock('show1')
    await l.acquireOnOpen()

    l.onLockStatusChanged({ lock: { user: 'bea', since: 10 } })
    expect(l.lock.value).toEqual({ user: 'bea', since: 10 })

    touchShowLock.mockClear()
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    expect(touchShowLock).not.toHaveBeenCalled()
  })

  test('onLockStatusChanged: wird der Lock frei, versucht dieser Tab automatisch die Übernahme', async () => {
    const l = useShowLock('show1')
    acquireShowLock.mockClear()
    l.onLockStatusChanged({ lock: null })
    await vi.waitFor(() => expect(acquireShowLock).toHaveBeenCalledWith('show1'))
  })

  test('Heartbeat ruft touchShowLock periodisch auf, solange der Lock mir gehört', async () => {
    vi.useFakeTimers()
    const l = useShowLock('show1')
    await l.acquireOnOpen()

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    expect(touchShowLock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    expect(touchShowLock).toHaveBeenCalledTimes(2)
  })

  test('Heartbeat übernimmt bei 423 den fremden Lock-Stand', async () => {
    vi.useFakeTimers()
    const l = useShowLock('show1')
    await l.acquireOnOpen()

    touchShowLock.mockRejectedValue(new ApiError('HTTP 423', 423, { lockedBy: 'eva', since: 3 }))
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    await vi.waitFor(() => expect(l.lock.value).toEqual({ user: 'eva', since: 3 }))
  })

  test('initLockEvents abonniert SSE mit onLockStatus/onTakeoverRequested/onPresence', () => {
    const l = useShowLock('show1')
    l.initLockEvents()
    expect(subscribeShow).toHaveBeenCalledWith('show1', expect.objectContaining({
      onLockStatus: expect.any(Function),
      onTakeoverRequested: expect.any(Function),
      onPresence: expect.any(Function),
    }))
  })

  test('Präsenz filtert den eigenen Nutzer aus der Liste heraus', () => {
    const l = useShowLock('show1')
    l.initLockEvents()
    const { onPresence } = subscribeShow.mock.calls[0][1]
    onPresence({ users: [{ username: 'anna', devices: ['web'], lastActivityAt: '' }, { username: 'bea', devices: ['web'], lastActivityAt: '' }] })
    expect(l.presentUsers.value).toEqual([{ username: 'bea', devices: ['web'], lastActivityAt: '' }])
  })

  test('cleanupLockEvents entfernt die SSE-Subscription und leert die Präsenzliste', () => {
    const unsubscribe = vi.fn()
    subscribeShow.mockReturnValue(unsubscribe)
    const l = useShowLock('show1')
    l.initLockEvents()
    l.cleanupLockEvents()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(l.presentUsers.value).toEqual([])
  })
})

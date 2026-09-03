import { describe, test, expect, vi } from 'vitest'
import { withLockConflict } from './useLockAwareCall'
import { ApiError } from '../api/client'

describe('withLockConflict', () => {
  test('423 ruft onLockConflict mit dem Fehler-Body auf und liefert undefined', async () => {
    const onLockConflict = vi.fn()
    const wrapped = withLockConflict(onLockConflict, async () => {
      throw new ApiError('Locked', 423, { lockedBy: 'bea' })
    })
    await expect(wrapped()).resolves.toBeUndefined()
    expect(onLockConflict).toHaveBeenCalledWith({ lockedBy: 'bea' })
  })

  test('423 ohne onLockConflict-Callback wirft nicht, liefert undefined', async () => {
    const wrapped = withLockConflict(undefined, async () => {
      throw new ApiError('Locked', 423, { lockedBy: 'bea' })
    })
    await expect(wrapped()).resolves.toBeUndefined()
  })

  test('andere Fehler werden durchgereicht', async () => {
    const wrapped = withLockConflict(undefined, async () => { throw new Error('netz') })
    await expect(wrapped()).rejects.toThrow('netz')
  })

  test('Erfolg liefert das Ergebnis unverändert', async () => {
    const wrapped = withLockConflict(undefined, async () => 'ok')
    await expect(wrapped()).resolves.toBe('ok')
  })

  test('Argumente werden unverändert an fn durchgereicht', async () => {
    const fn = vi.fn(async (a: number, b: string) => `${a}-${b}`)
    const wrapped = withLockConflict(undefined, fn)
    await expect(wrapped(1, 'x')).resolves.toBe('1-x')
    expect(fn).toHaveBeenCalledWith(1, 'x')
  })
})

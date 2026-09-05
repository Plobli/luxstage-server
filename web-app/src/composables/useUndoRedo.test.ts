import { describe, test, expect, vi } from 'vitest'
import { useServerUndoRedo } from './useUndoRedo'
import { ApiError } from '../api/client'

const ok = async () => undefined
const fails = (status: number, body: any = {}) => async () => { throw new ApiError(`HTTP ${status}`, status, body) }

describe('useServerUndoRedo', () => {
  test('startet mit offenem Undo und geschlossenem Redo', () => {
    const s = useServerUndoRedo({ undo: ok, redo: ok })
    expect(s.canUndo.value).toBe(true)
    expect(s.canRedo.value).toBe(false)
  })

  test('ein erfolgreiches Undo öffnet Redo', async () => {
    const s = useServerUndoRedo({ undo: ok, redo: ok })
    expect(await s.undo()).toBe(true)
    expect(s.canRedo.value).toBe(true)
  })

  test('400 bedeutet leerer Stack und schließt genau die aufgerufene Richtung', async () => {
    const s = useServerUndoRedo({ undo: fails(400), redo: ok })
    expect(await s.undo()).toBe(false)
    expect(s.canUndo.value).toBe(false)
    expect(s.canRedo.value).toBe(false)
  })

  test('400 beim Redo schließt Redo, lässt Undo offen', async () => {
    const s = useServerUndoRedo({ undo: ok, redo: fails(400) })
    expect(await s.redo()).toBe(false)
    expect(s.canRedo.value).toBe(false)
    expect(s.canUndo.value).toBe(true)
  })

  test('423 meldet den Lock-Konflikt und ändert die Verfügbarkeit nicht', async () => {
    const onLockConflict = vi.fn()
    const s = useServerUndoRedo({ undo: fails(423, { lockedBy: 'bea' }), redo: ok, onLockConflict })
    expect(await s.undo()).toBe(false)
    expect(onLockConflict).toHaveBeenCalledWith({ lockedBy: 'bea' })
    expect(s.canUndo.value).toBe(true)
  })

  test('unerwartete Fehler werden durchgereicht, nicht verschluckt', async () => {
    const s = useServerUndoRedo({ undo: async () => { throw new Error('netz kaputt') }, redo: ok })
    await expect(s.undo()).rejects.toThrow('netz kaputt')
  })

  test('onAfter läuft nach erfolgreichem Undo, nicht nach einem leeren Stack', async () => {
    const onAfter = vi.fn()
    const s = useServerUndoRedo({ undo: ok, redo: fails(400), onAfter })
    await s.undo()
    expect(onAfter).toHaveBeenCalledTimes(1)
    await s.redo()
    expect(onAfter).toHaveBeenCalledTimes(1)
  })

  test('ein erfolgreiches Redo setzt canRedo nicht fälschlich wieder auf true (Bug: Redo klemmte nach einem Klick)', async () => {
    let redoStackEmpty = false
    const redo = async () => {
      if (redoStackEmpty) throw new ApiError('HTTP 400', 400, {})
      redoStackEmpty = true // Server-Stack hat nach diesem Redo genau einen Eintrag verbraucht
    }
    const s = useServerUndoRedo({ undo: ok, redo })
    await s.undo()
    expect(s.canRedo.value).toBe(true)
    expect(await s.redo()).toBe(true)
    // Der Redo-Stack ist jetzt server-seitig leer — ein zweites Redo muss das
    // auch tatsächlich per 400 melden, statt dass canRedo optimistisch offen bleibt.
    expect(await s.redo()).toBe(false)
    expect(s.canRedo.value).toBe(false)
  })

  test('markSaved öffnet Undo und schließt Redo', async () => {
    const s = useServerUndoRedo({ undo: ok, redo: ok })
    await s.undo()
    expect(s.canRedo.value).toBe(true)
    s.markSaved()
    expect(s.canUndo.value).toBe(true)
    expect(s.canRedo.value).toBe(false)
  })

  test('Cmd/Ctrl+Z löst Undo aus, mit Shift Redo', async () => {
    const undo = vi.fn(ok)
    const redo = vi.fn(ok)
    const s = useServerUndoRedo({ undo, redo })

    const key = (init: Partial<KeyboardEvent>) =>
      ({ ...init, preventDefault: vi.fn() }) as unknown as KeyboardEvent

    s.onUndoRedoKeydown(key({ key: 'z', metaKey: true, ctrlKey: true, shiftKey: false }))
    s.onUndoRedoKeydown(key({ key: 'z', metaKey: true, ctrlKey: true, shiftKey: true }))
    await Promise.resolve()

    expect(undo).toHaveBeenCalledTimes(1)
    expect(redo).toHaveBeenCalledTimes(1)
  })

  test('ein einfaches z ohne Modifier löst nichts aus', () => {
    const undo = vi.fn(ok)
    const s = useServerUndoRedo({ undo, redo: ok })
    s.onUndoRedoKeydown({ key: 'z', metaKey: false, ctrlKey: false, shiftKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(undo).not.toHaveBeenCalled()
  })
})

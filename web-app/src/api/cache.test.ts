import { describe, test, expect, beforeEach } from 'vitest'
import { cached, invalidate, invalidateAll } from './cache'

beforeEach(() => invalidateAll())

describe('cached', () => {
  test('ruft den Fetcher nur einmal und liefert danach aus dem Cache', async () => {
    let calls = 0
    const fetcher = async () => { calls++; return 'wert' }

    expect(await cached('k', fetcher)).toBe('wert')
    expect(await cached('k', fetcher)).toBe('wert')
    expect(calls).toBe(1)
  })

  test('dedupliziert gleichzeitige Aufrufe zu einem einzigen Request', async () => {
    let calls = 0
    let release: (v: string) => void = () => {}
    const fetcher = () => { calls++; return new Promise<string>(r => { release = r }) }

    const a = cached('k', fetcher)
    const b = cached('k', fetcher)
    release('wert')

    expect(await a).toBe('wert')
    expect(await b).toBe('wert')
    expect(calls).toBe(1)
  })

  test('nach einem Fehler wird erneut angefragt statt dauerhaft zu blockieren', async () => {
    let calls = 0
    const failing = async () => { calls++; throw new Error('netz kaputt') }

    await expect(cached('k', failing)).rejects.toThrow('netz kaputt')
    await expect(cached('k', failing)).rejects.toThrow('netz kaputt')
    expect(calls).toBe(2)
  })

  test('invalidate erzwingt einen neuen Request', async () => {
    let calls = 0
    const fetcher = async () => { calls++; return calls }

    expect(await cached('k', fetcher)).toBe(1)
    invalidate('k')
    expect(await cached('k', fetcher)).toBe(2)
  })

  test('abgelaufene Einträge werden neu geholt', async () => {
    let calls = 0
    const fetcher = async () => { calls++; return calls }

    expect(await cached('k', fetcher, 0)).toBe(1)
    expect(await cached('k', fetcher, 0)).toBe(2)
  })

  test('verschiedene Schlüssel teilen sich keinen Eintrag', async () => {
    expect(await cached('a', async () => 'A')).toBe('A')
    expect(await cached('b', async () => 'B')).toBe('B')
  })
})

import { describe, test, expect, vi, beforeEach } from 'vitest'

const invalidate = vi.fn()
const put = vi.fn()
const post = vi.fn()
const del = vi.fn()
const get = vi.fn()

vi.mock('./cache', () => ({ invalidate: (...a: any[]) => invalidate(...a) }))
vi.mock('./client', () => ({
  api: {
    get: (...a: any[]) => get(...a),
    post: (...a: any[]) => post(...a),
    put: (...a: any[]) => put(...a),
    delete: (...a: any[]) => del(...a),
  },
}))

const shows = await import('./shows')

beforeEach(() => {
  invalidate.mockReset()
  for (const m of [get, post, put, del]) m.mockReset().mockResolvedValue({ ok: true })
})

describe('Show-Mutationen verwerfen den Listen-Cache', () => {
  test.each([
    ['createShow', () => shows.createShow({ id: 's1' })],
    ['updateMeta', () => shows.updateMeta('s1', { name: 'Neu' })],
    ['archiveShow', () => shows.archiveShow('s1')],
    ['deleteShowPermanent', () => shows.deleteShowPermanent('s1')],
    ['restoreShow', () => shows.restoreShow('s1')],
  ])('%s invalidiert "shows"', async (_name, call) => {
    await call()
    expect(invalidate).toHaveBeenCalledWith('shows')
  })

  test('lesende Aufrufe invalidieren nicht', async () => {
    await shows.fetchShows()
    await shows.fetchShow('s1')
    await shows.fetchArchivedShows()
    expect(invalidate).not.toHaveBeenCalled()
  })

  test('das Ergebnis des Aufrufs wird durchgereicht', async () => {
    put.mockResolvedValue({ id: 's1', name: 'Neu' })
    await expect(shows.updateMeta('s1', { name: 'Neu' })).resolves.toEqual({ id: 's1', name: 'Neu' })
  })

  test('bei einem Fehler wird nicht invalidiert', async () => {
    put.mockRejectedValue(new Error('423 Locked'))
    await expect(shows.updateMeta('s1', {})).rejects.toThrow('423 Locked')
    expect(invalidate).not.toHaveBeenCalled()
  })

  test('Argumente erreichen den HTTP-Client unverändert', async () => {
    await shows.updateMeta('s1', { name: 'Neu' })
    expect(put).toHaveBeenCalledWith('/api/shows/s1/meta', { name: 'Neu' })
  })
})

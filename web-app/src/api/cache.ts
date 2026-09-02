const store = new Map<string, { data: any, ts: number }>()

// Läuft ein Request zu einem Schlüssel bereits, bekommen weitere Aufrufer
// dasselbe Promise statt eines zweiten HTTP-Requests — der Cache füllt sich
// erst nach dem Auflösen, zwei gleichzeitige Aufrufe liefen sonst parallel los.
const inFlight = new Map<string, Promise<any>>()

export function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const entry = store.get(key)
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data as T)

  const running = inFlight.get(key)
  if (running) return running as Promise<T>

  const promise = fetcher()
    .then(data => {
      store.set(key, { data, ts: Date.now() })
      return data
    })
    .finally(() => { inFlight.delete(key) })
  inFlight.set(key, promise)
  return promise
}

export function invalidate(key: string): void {
  store.delete(key)
}

export function invalidateAll(): void {
  store.clear()
}


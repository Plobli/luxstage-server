// server/login-rate-limit.js
// Pro-IP-Attempt-Limiter für Login-artige Endpunkte — extrahiert aus
// routes/auth.js, damit routes/operator.js dieselbe Absicherung nutzen kann,
// ohne dass Tenant- und Operator-Login sich einen Zähler-Store teilen (ein
// Angreifer, der den Tenant-Login einer fremden IP-Bucket aufbraucht, soll
// nicht zufällig auch das Operator-Panel für dieselbe IP sperren, und
// umgekehrt).
export function createLoginRateLimiter({ maxAttempts = 10, windowMs = 15 * 60 * 1000, maxTrackedIps = 10_000 } = {}) {
  const attempts = new Map()

  function purgeExpired() {
    const cutoff = Date.now() - windowMs
    for (const [ip, entry] of attempts) {
      if (entry.firstAt <= cutoff) attempts.delete(ip)
    }
  }
  const cleanup = setInterval(purgeExpired, windowMs)
  cleanup.unref()

  function isRateLimited(ip) {
    const now = Date.now()
    const entry = attempts.get(ip)
    if (!entry) return false
    if (now - entry.firstAt > windowMs) { attempts.delete(ip); return false }
    return entry.count >= maxAttempts
  }

  function recordFailedAttempt(ip) {
    const now = Date.now()
    const entry = attempts.get(ip)
    if (!entry || now - entry.firstAt > windowMs) {
      if (!entry && attempts.size >= maxTrackedIps) {
        attempts.delete(attempts.keys().next().value)
      }
      attempts.set(ip, { count: 1, firstAt: now })
    } else {
      attempts.set(ip, { ...entry, count: entry.count + 1 })
    }
  }

  return { isRateLimited, recordFailedAttempt }
}

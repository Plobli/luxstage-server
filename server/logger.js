// Schlanker, strukturierter Logger.
//
// Ersetzt schrittweise die direkten console-Aufrufe. Ziel ist nicht ein
// Framework, sondern ein einheitliches Format mit Log-Level, damit
// sicherheitsrelevante Ereignisse (Login-Fehlschläge, Reset-Anforderungen,
// Nutzeranlage) auswertbar werden statt im Zugriffs-Log unterzugehen.
//
// Format: 2026-09-01T12:00:00.000Z WARN [auth] Login fehlgeschlagen user=… ip=…
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

const threshold = LEVELS[process.env.LOG_LEVEL ?? 'info'] ?? LEVELS.info

function format(value) {
  const s = String(value ?? '')
  // Werte mit Leerraum quoten, damit key=value maschinell lesbar bleibt.
  return /\s/.test(s) ? JSON.stringify(s) : s
}

function emit(level, scope, msg, fields) {
  if (LEVELS[level] > threshold) return
  const parts = fields
    ? Object.entries(fields).map(([k, v]) => `${k}=${format(v)}`).join(' ')
    : ''
  const line = `${new Date().toISOString()} ${level.toUpperCase()} [${scope}] ${msg}${parts ? ' ' + parts : ''}`
  ;(level === 'error' ? console.error : console.log)(line)
}

export function logger(scope) {
  return {
    error: (msg, fields) => emit('error', scope, msg, fields),
    warn: (msg, fields) => emit('warn', scope, msg, fields),
    info: (msg, fields) => emit('info', scope, msg, fields),
    debug: (msg, fields) => emit('debug', scope, msg, fields),
  }
}

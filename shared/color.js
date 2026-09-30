// Gemeinsame Farbkonvertierung für Server (PDF) und Web-App (Filter-Badges).
// Server importiert relativ, Web-App über den Vite-Alias '@shared/color.js'.

/** Wählt Schwarz oder Weiß als lesbaren Text auf einer #rrggbb-Hintergrundfarbe. */
export function contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return l > 0.5 ? '#000000' : '#ffffff'
}

// Feste Palette für Prio/Reihenfolge-Badges (Ch, ChannelTable, PDF). Reihenfolge
// kodiert Rang, keine Wertung — daher keine Ampelfarben (rot=schlecht etc.).
const SEQUENCE_PALETTE = [
  '#4c80c4', '#c1902e', '#4a9d5c', '#bd5d92', '#8968c4',
  '#2f97a1', '#b3963c', '#bd5c4d', '#3a9d81', '#666cc4',
]

function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function rgbDistance(a, b) {
  let d = 0
  for (const i of [1, 3, 5]) d += (parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) ** 2
  return Math.sqrt(d)
}

const MIN_DISTANCE = 45

/**
 * Weist jedem unterschiedlichen Prio/Reihenfolge-Wert eine eigene Badge-Farbe zu
 * (Map Wert → #rrggbb). Garantiert: verschiedene Werte bekommen nie dieselbe (und
 * keine fast gleiche) Farbe. Reine Zahlen 1–10 nutzen die feste Palette; alle
 * übrigen Werte (natürlich sortiert) bekommen der Reihe nach generierte Farben,
 * die zu allen bisher vergebenen genug Abstand haben. Die Farbe hängt damit vom
 * Wertebestand ab — immer alle Werte des Kontexts übergeben.
 */
export function buildSequenceColorMap(values) {
  const distinct = [...new Set((values ?? []).map(v => String(v ?? '').trim()).filter(Boolean))]
  distinct.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const map = new Map()
  const used = []
  const rest = []
  for (const v of distinct) {
    const n = /^\d+$/.test(v) ? parseInt(v, 10) : 0
    if (n >= 1 && n <= SEQUENCE_PALETTE.length) {
      map.set(v, SEQUENCE_PALETTE[n - 1])
      used.push(SEQUENCE_PALETTE[n - 1])
    } else rest.push(v)
  }
  // Palettenfarben immer sperren, damit generierte nicht daran erinnern
  for (const c of SEQUENCE_PALETTE) if (!used.includes(c)) used.push(c)
  let step = 0
  let minDist = MIN_DISTANCE
  for (const v of rest) {
    let color
    let tries = 0
    do {
      const hue = (step * 137.508) % 360
      const light = [0.5, 0.42, 0.6][Math.floor(step / 24) % 3]
      color = hslToHex(hue, 0.5, light)
      step++
      tries++
      if (tries > 400) { minDist = Math.max(1, minDist - 5); tries = 0 }
    } while (used.some(u => rgbDistance(u, color) < minDist))
    map.set(v, color)
    used.push(color)
  }
  return map
}

/** Badge-Farbe für einen Wert aus einer Karte von buildSequenceColorMap; leer → null. */
export function sequenceOrderColor(value, colorMap) {
  const v = (value ?? '').toString().trim()
  if (!v) return null
  return colorMap?.get(v) ?? null
}

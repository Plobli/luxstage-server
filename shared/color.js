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

/**
 * Leitet aus einem Prio/Reihenfolge-Wert (z.B. "1", "2a", "Akt 2") eine stabile
 * Badge-Farbe ab. Führende Zahl bestimmt die Palettenfarbe (1-indiziert, damit
 * "1" immer dieselbe Farbe hat); reiner Text bekommt eine Hash-basierte Farbe.
 * Leer/null → null (kein Badge).
 */
export function sequenceOrderColor(value) {
  const v = (value ?? '').trim()
  if (!v) return null
  const leadingNumber = v.match(/^\d+/)
  if (leadingNumber) {
    const n = parseInt(leadingNumber[0], 10)
    return SEQUENCE_PALETTE[(n - 1) % SEQUENCE_PALETTE.length]
  }
  let hash = 0
  for (let i = 0; i < v.length; i++) hash = (hash * 31 + v.charCodeAt(i)) | 0
  return SEQUENCE_PALETTE[Math.abs(hash) % SEQUENCE_PALETTE.length]
}

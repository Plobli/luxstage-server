import filters from '../../../shared/filters.json'

interface FilterEntry {
  code: string;
  name: string;
  hex: string;
  equivalent?: string;
}

// Build lookup: code → entry, plus equivalent code → same entry
const BY_CODE: Record<string, FilterEntry> = {}
for (const f of filters as FilterEntry[]) {
  if (!f.hex) continue
  BY_CODE[f.code] = f
  if (f.equivalent) BY_CODE[f.equivalent] = f
}

/**
 * Normalizes user input to a primary filter code.
 * Handles: "201", "L201", "R44", "l201", "r44"
 */
export function normalizeInput(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim().toUpperCase()
  if (BY_CODE[s]) return s
  // Normalize padding
  if (/^L\d+$/.test(s)) {
    const code = `L${s.slice(1).padStart(3, '0')}`
    if (BY_CODE[code]) return code
  }
  if (/^R\d+$/.test(s)) {
    const code = `R${s.slice(1).padStart(2, '0')}`
    if (BY_CODE[code]) return code
  }
  // Plain number — try Lee first, then Rosco
  const num = s.match(/^(\d+)$/)
  if (num) {
    const lee = `L${num[1].padStart(3, '0')}`
    if (BY_CODE[lee]) return lee
    const rosco = `R${num[1].padStart(2, '0')}`
    if (BY_CODE[rosco]) return rosco
  }
  return null
}

/**
 * Returns the hex color for a filter input, or null.
 */
export function filterColorHex(input: string | null | undefined): string | null {
  const code = normalizeInput(input)
  return code ? (BY_CODE[code]?.hex ?? null) : null
}

/**
 * Returns inline style object for a filter badge, or null if no match.
 */
export function filterBadgeStyle(input: string | null | undefined): { backgroundColor: string, color: string } | null {
  const hex = filterColorHex(input)
  if (!hex) return null
  return { backgroundColor: hex, color: contrastColor(hex) }
}

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return l > 0.5 ? '#000000' : '#ffffff'
}

/**
 * Liste aller Filter für Autocomplete.
 * Einträge mit Äquivalent zeigen beide Codes: "L052 / R52"
 */
export const ALL_FILTERS = (filters as FilterEntry[])
  .filter(f => f.hex)
  .map(f => ({
    code: f.code,
    altCode: f.equivalent ?? null,
    displayCode: f.equivalent ? `${f.code} / ${f.equivalent}` : f.code,
    name: f.name,
    hex: f.hex,
  }))


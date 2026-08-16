import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const filtersData = JSON.parse(fs.readFileSync(join(__dirname, '../../shared/filters.json'), 'utf8'))

// Build lookup: code → hex (same logic as filterColors.js in web-app)
const FILTER_HEX = {}
for (const f of filtersData) {
  if (!f.hex) continue
  FILTER_HEX[f.code] = f.hex
  if (f.equivalent) FILTER_HEX[f.equivalent] = f.hex
}

export function leeHex(input) {
  if (!input) return null
  const s = input.trim().toUpperCase()
  if (FILTER_HEX[s]) return FILTER_HEX[s]
  // Normalize padding: "L147" → "L147", "147" → "L147"
  const num = s.match(/^[LR]?(\d+)$/)
  if (num) {
    const lee = `L${num[1].padStart(3, '0')}`
    if (FILTER_HEX[lee]) return FILTER_HEX[lee]
    const rosco = `R${num[1].padStart(2, '0')}`
    if (FILTER_HEX[rosco]) return FILTER_HEX[rosco]
  }
  return null
}

export function contrastColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return (0.299*r + 0.587*g + 0.114*b)/255 > 0.5 ? '#000000' : '#ffffff'
}

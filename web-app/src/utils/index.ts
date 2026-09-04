import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// YYYY-MM-DD -> DD.MM.YYYY. emptyValue: was für einen leeren/fehlenden Wert
// angezeigt wird (Listen wollen '', der Wizard-Zusammenfassung '—').
export function formatDatum(d: string | null | undefined, emptyValue = ''): string {
  if (!d) return emptyValue
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

// Spielzeit läuft Juli-Juni (Theaterkonvention) — vor Juli zählt das laufende
// Kalenderjahr noch zur vorherigen Spielzeit.
export function currentSpielzeit(): string {
  const now = new Date()
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${String(startYear).slice(-2)}/${String(startYear + 1).slice(-2)}`
}

export function generateShowId(name: string, datum: string): string {
  const slug = name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const year = datum ? datum.slice(0, 4) : new Date().getFullYear()
  return slug ? `${slug}-${year}` : ''
}


// Parser für die Bühnen-Template-CSV (Semikolon-getrennt, Kopfzeile beginnt
// mit "channel"). Reine Funktion ohne Vue-Bezug — damit unabhängig von einer
// gemounteten Komponente testbar.

export type TemplateCsvRow = Record<string, string>

/**
 * Liest die Zeilen ab der Kopfzeile als Objekte. Zeilen vor der Kopfzeile
 * (z.B. Exporter-Kommentare) werden übersprungen; fehlt sie, ist das Ergebnis leer.
 */
export function parseTemplateCsv(text: string): TemplateCsvRow[] {
  const lines = String(text ?? '').trim().split('\n').filter(Boolean)
  const headerIdx = lines.findIndex(l => l.startsWith('channel'))
  if (headerIdx === -1) return []

  const headers = lines[headerIdx].split(';').map(h => h.trim())
  return lines.slice(headerIdx + 1).map(line => {
    const vals = line.split(';')
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
}

/** Vorlagenname aus dem Dateinamen: ohne .csv-Endung und ohne Leerraum. */
export function templateNameFromFile(fileName: string): string {
  return String(fileName ?? '').replace(/\.csv$/i, '').trim()
}

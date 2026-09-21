import { describe, test, expect } from 'vitest'
import { markdownToTiptapDoc } from './markdownToTiptap'

// EMPTY_DOC-Konstante aus MarkdownEditor.vue nachgebildet, um den Fallback-Fall
// zu erkennen, ohne den Vue-Editor zu mounten.
const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

function simulateEditorParse(json: string): any {
  // Bildet MarkdownEditor.vue's parseContent() nach: JSON.parse, Fallback bei Fehler.
  if (!json) return EMPTY_DOC
  try { return JSON.parse(json) } catch { return EMPTY_DOC }
}

describe('markdownToTiptapDoc', () => {
  test('Überschrift wird zu einem heading-Knoten', () => {
    const doc = markdownToTiptapDoc('# Hängeplan')
    expect(doc.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } })
  })

  test('Fließtext wird zu einem paragraph-Knoten mit text-Kind', () => {
    const doc = markdownToTiptapDoc('Portalbrücke auf 4,20m.')
    expect(doc.content?.[0].type).toBe('paragraph')
    expect(doc.content?.[0].content?.[0]).toMatchObject({ type: 'text', text: 'Portalbrücke auf 4,20m.' })
  })

  test('Ergebnis ist ein valides doc-Objekt mit content-Array', () => {
    const doc = markdownToTiptapDoc('# Titel\n\nText hier.\n\n- Punkt eins\n- Punkt zwei')
    expect(doc.type).toBe('doc')
    expect(Array.isArray(doc.content)).toBe(true)
    expect(doc.content!.length).toBeGreaterThan(0)
  })

  test('Round-Trip: JSON.stringify(doc) wird von der Editor-Parse-Logik undestruktiv geparst', () => {
    const markdown = '# Zugstangen\n\nBar 3 auf 6,00m.\n\n- Zug 12: 5,50m\n- Zug 14: 6,20m'
    const doc = markdownToTiptapDoc(markdown)
    const serialized = JSON.stringify(doc)
    const parsed = simulateEditorParse(serialized)
    expect(parsed).not.toEqual(EMPTY_DOC)
    expect(parsed.type).toBe('doc')
    expect(parsed.content.length).toBeGreaterThan(0)
  })

  test('leerer Markdown-String ergibt ein doc mit leerem paragraph (kein Crash, kein EMPTY_DOC-Verlust)', () => {
    const doc = markdownToTiptapDoc('')
    expect(doc).toEqual(EMPTY_DOC)
  })

  test('Tabelle wird zu einem table-Knoten mit tableRow/tableHeader/tableCell', () => {
    const doc = markdownToTiptapDoc('| Kanal | Gerät |\n|---|---|\n| 1 | PAR64 |')
    const table = doc.content?.find(n => n.type === 'table')
    expect(table).toBeDefined()
    expect(table?.content?.[0].type).toBe('tableRow')
    expect(table?.content?.[0].content?.[0].type).toBe('tableHeader')
    expect(table?.content?.[1].content?.[0].type).toBe('tableCell')
  })
})

// Konvertiert das Markdown-Subset, das Claude Vision im Einleuchtplan-Freitext
// liefert (Überschriften, Listen, Tabellen, Fließtext — siehe server/plan-scan.js
// Prompt), in ein Tiptap-JSON-Dokument. setup_markdown wird im WebApp-Editor als
// Tiptap-JSON gespeichert (siehe MarkdownEditor.vue parseContent), nicht als
// roher Markdown-String — ein direkt geschriebener Markdown-String würde beim
// nächsten Öffnen des Editors verworfen (JSON.parse schlägt fehl → EMPTY_DOC).
// Kein vollständiger Markdown-Parser: deckt nur das ab, was tiptap-parse.js
// (server/pdf/tiptap-parse.js, parseSetupSection) als Referenz-Subset zeigt.
// Reine Funktion ohne Vue-Bezug, unabhängig testbar.

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
}

function textNode(text: string): TiptapNode {
  return { type: 'text', text }
}

function stripEmphasis(line: string): string {
  return line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
}

function paragraphNode(text: string): TiptapNode {
  return { type: 'paragraph', content: [textNode(text)] }
}

function headingNode(level: number, text: string): TiptapNode {
  return { type: 'heading', attrs: { level }, content: text ? [textNode(text)] : [] }
}

function listNode(items: string[]): TiptapNode {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [paragraphNode(item)],
    })),
  }
}

function tableCellNode(type: 'tableHeader' | 'tableCell', text: string): TiptapNode {
  return { type, content: [paragraphNode(text)] }
}

function tableNode(rows: string[][]): TiptapNode {
  return {
    type: 'table',
    content: rows.map((cells, ri) => ({
      type: 'tableRow',
      content: cells.map(cell => tableCellNode(ri === 0 ? 'tableHeader' : 'tableCell', cell)),
    })),
  }
}

/** Parst das Markdown-Subset (Headings, Tabellen, Listen, Fließtext) in Tiptap-Knoten. */
export function markdownToTiptapNodes(markdown: string): TiptapNode[] {
  if (!markdown || !markdown.trim()) return []
  const lines = markdown.trim().split('\n')
  const nodes: TiptapNode[] = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = stripEmphasis(raw)
    if (!line.trim()) { i++; continue }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      nodes.push(headingNode(headingMatch[1].length, headingMatch[2].trim()))
      i++; continue
    }

    if (/^\|.*\|$/.test(line.trim())) {
      const rows: string[][] = []
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const l = stripEmphasis(lines[i])
        if (!/^\|[\s\-:|]+\|$/.test(l.trim())) {
          rows.push(l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
        }
        i++
      }
      if (rows.length) nodes.push(tableNode(rows))
      continue
    }

    const listMatch = line.match(/^[\s]*[-*]\s+(.+)/)
    if (listMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const l = stripEmphasis(lines[i])
        const m = l.match(/^[\s]*[-*]\s+(.+)/)
        if (!m) break
        items.push(m[1].trim())
        i++
      }
      nodes.push(listNode(items))
      continue
    }

    nodes.push(paragraphNode(line.trim()))
    i++
  }
  return nodes
}

/** Baut ein vollständiges Tiptap-`doc`-Dokument aus einem Markdown-String. */
export function markdownToTiptapDoc(markdown: string): TiptapNode {
  const content = markdownToTiptapNodes(markdown)
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

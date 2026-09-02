// Registry der Section-Typen für den PDF-Export.
//
// Ein neuer Section-Typ ist hier ein Eintrag — pdf.js bleibt unangetastet.
// Vorher stand dieselbe Unterscheidung als if/else-Kaskade im Orchestrator,
// mit einer zweiten, parallel gepflegten Kaskade für die Content-Prüfung.
import { renderFieldsSection, renderKvTableSection } from './layout-primitives.js'
import { parseSetupSection, renderSetupBlocks } from './tiptap-parse.js'

export const SECTION_RENDERERS = {
  'kv-table': {
    hasContent: (sec) => (sec.rows ?? []).some(r => r.value?.trim()),
    render: (doc, sec, _content, x, w) => renderKvTableSection(doc, sec.rows ?? [], x, w),
  },
  fields: {
    hasContent: (sec, content) => (sec.fields ?? []).some(f => {
      const esc = f.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return content.match(new RegExp(`^${esc}:\\s*(.+)$`, 'm'))?.[1]?.trim()
    }),
    render: (doc, sec, content, x, w) => renderFieldsSection(doc, sec.fields, content, x, w),
  },
}

// Fallback für alles Übrige (Setup-/Markdown-Text).
export const DEFAULT_RENDERER = {
  hasContent: (_sec, content) => parseSetupSection(content).length > 0,
  render: (doc, _sec, content, x, w) => {
    const blocks = parseSetupSection(content)
    if (blocks.length) renderSetupBlocks(doc, blocks, x, w)
  },
}

export const rendererFor = (type) => SECTION_RENDERERS[type] ?? DEFAULT_RENDERER

import { mm, FONT_NORMAL, FONT_BOLD } from './constants.js'

function tiptapNodeText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (Array.isArray(node.content)) return node.content.map(tiptapNodeText).join('')
  return ''
}

function parseTiptapDoc(doc) {
  const blocks = []
  if (!doc?.content) return blocks
  for (const node of doc.content) {
    if (node.type === 'heading') {
      blocks.push({ type: 'heading', level: node.attrs?.level ?? 1, text: tiptapNodeText(node) })
    } else if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      const items = (node.content ?? []).map(li => tiptapNodeText(li).trim()).filter(Boolean)
      if (items.length) blocks.push({ type: 'list', items })
    } else if (node.type === 'table') {
      const rows = []
      for (const tr of (node.content ?? [])) {
        const cells = (tr.content ?? []).map(td => tiptapNodeText(td).trim())
        rows.push(cells)
      }
      if (rows.length) blocks.push({ type: 'table', rows })
    } else if (node.type === 'paragraph') {
      const text = tiptapNodeText(node).trim()
      if (text) blocks.push({ type: 'text', text })
    }
  }
  return blocks
}

export function parseSetupSection(content) {
  if (!content) return []
  const trimmed = content.trim()
  if (trimmed.startsWith('{')) {
    try {
      const doc = JSON.parse(trimmed)
      return parseTiptapDoc(doc)
    } catch {}
  }
  const lines = trimmed.split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    if (!line.trim()) { i++; continue }
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] })
      i++; continue
    }
    if (/^\|.*\|$/.test(line.trim())) {
      const rows = []
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const l = lines[i].replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
        if (!/^\|[\s\-:|]+\|$/.test(l.trim())) {
          const cells = l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
          rows.push(cells)
        }
        i++
      }
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }
    const listMatch = line.match(/^[\s]*[-*]\s+(.+)/)
    if (listMatch) {
      const items = []
      while (i < lines.length) {
        const l = lines[i].replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
        const m = l.match(/^[\s]*[-*]\s+(.+)/)
        if (!m) break
        items.push(m[1])
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }
    blocks.push({ type: 'text', text: line.trim() })
    i++
  }
  return blocks
}

export function renderSetupBlocks(doc, blocks, margin, usableW) {
  for (const block of blocks) {
    if (block.type === 'heading') {
      if (block.level <= 2) {
        doc.moveDown(0.5)
        doc.font(FONT_BOLD).fontSize(11).text(block.text, margin, doc.y, { width: usableW, lineBreak: true })
        doc.moveTo(margin, doc.y + 1).lineTo(margin + usableW, doc.y + 1).stroke('#cccccc')
        doc.moveDown(0.3)
      } else {
        doc.moveDown(0.3)
        doc.font(FONT_BOLD).fontSize(9).text(block.text, margin, doc.y, { width: usableW, lineBreak: true })
        doc.moveDown(0.1)
      }
    } else if (block.type === 'text') {
      doc.font(FONT_NORMAL).fontSize(8.5).text(block.text, margin, doc.y, { width: usableW, lineBreak: true })
    } else if (block.type === 'list') {
      for (const item of block.items) {
        doc.font(FONT_NORMAL).fontSize(8.5)
          .text('•  ' + item, margin + mm(3), doc.y, { width: usableW - mm(3), lineGap: 1, lineBreak: true })
      }
    } else if (block.type === 'table') {
      const rows = block.rows
      if (!rows.length) continue
      const colCount = Math.max(...rows.map(r => r.length))
      const col0W = mm(40)
      const colRest = (usableW - col0W) / Math.max(colCount - 1, 1)
      let y = doc.y
      for (let ri = 0; ri < rows.length; ri++) {
        const isHeader = ri === 0
        const font = isHeader ? FONT_BOLD : FONT_NORMAL
        // Berechne Zeilenhöhe anhand des längsten Zellinhalts
        let rowH = mm(5.5)
        for (let ci = 0; ci < rows[ri].length; ci++) {
          const w = ci === 0 ? col0W : colRest
          const cellText = rows[ri][ci] || ''
          if (!cellText) continue
          const h = doc.font(font).fontSize(8).heightOfString(cellText, { width: w - mm(3) }) + mm(2.4)
          if (h > rowH) rowH = h
        }
        if (isHeader) {
          doc.rect(margin, y, usableW, rowH).fill('#e8e8e8')
          doc.fill('black')
        }
        doc.rect(margin, y, usableW, rowH).stroke('#cccccc')
        let x = margin
        for (let ci = 0; ci < rows[ri].length; ci++) {
          const w = ci === 0 ? col0W : colRest
          doc.font(font).fontSize(8)
            .fill('black')
            .text(rows[ri][ci] || '', x + mm(1.5), y + mm(1.2), {
              width: w - mm(3), lineBreak: true,
            })
          x += w
        }
        y += rowH
      }
      doc.y = y
      doc.moveDown(0.3)
    }
  }
}

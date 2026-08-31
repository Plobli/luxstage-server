// pdf/network.js — Netzwerk-Verkabelung PDF-Export
import PDFDocument from 'pdfkit'
import { mm, PAGE_MARGIN, FONT_NORMAL, FONT_BOLD, ROW_MIN_H } from './constants.js'
import { drawRow } from './layout-primitives.js'

const TYPE_LABELS = { dose: 'Dose', switch: 'Switch', geraet: 'Gerät' }
function nodeLabel(n) { return n?.label || TYPE_LABELS[n?.type] || '' }
function connFieldForNode(conn, nodeId) {
  if (conn.from_node_id === nodeId) return 'from'
  if (conn.to_node_id === nodeId) return 'to'
  return null
}

export function generateNetworkPDF(nodes, connections, res) {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: PAGE_MARGIN, autoFirstPage: true })
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="netzwerk-verkabelung.pdf"',
    'Referrer-Policy': 'no-referrer',
  })
  doc.pipe(res)

  const pageW = doc.page.width
  const pageH = doc.page.height
  const usableW = pageW - PAGE_MARGIN * 2
  const FOOTER_H = mm(8)
  const printableBottom = pageH - PAGE_MARGIN - FOOTER_H

  const printedAt = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  let pageNum = 0
  function addFooter() {
    pageNum++
    const fy = pageH - PAGE_MARGIN - mm(4)
    const savedY = doc.y
    doc.y = PAGE_MARGIN
    doc.font(FONT_NORMAL).fontSize(7).fillColor('#888888')
      .text(`Netzwerk — ${printedAt}`, PAGE_MARGIN, fy, { width: usableW / 2, lineBreak: false })
    doc.text(`Seite ${pageNum}`, PAGE_MARGIN + usableW / 2, fy, { width: usableW / 2, align: 'right', lineBreak: false })
    doc.fillColor('black')
    doc.y = savedY
  }
  addFooter()

  doc.font(FONT_BOLD).fontSize(16).fillColor('black').text('Netzwerk — Verkabelung', PAGE_MARGIN, PAGE_MARGIN)
  doc.font(FONT_NORMAL).fontSize(10).text(printedAt, PAGE_MARGIN, PAGE_MARGIN + mm(8))
  let y = PAGE_MARGIN + mm(16)

  const portCols = [
    { text: 'Port', w: mm(18) },
    { text: 'Ziel', w: usableW - mm(18) - mm(22) },
    { text: 'Zielport', w: mm(22) },
  ]

  const switches = nodes.filter(n => n.type === 'switch')
    .sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || nodeLabel(a).localeCompare(nodeLabel(b)))

  for (const sw of switches) {
    const used = connections.filter(c => connFieldForNode(c, sw.id)).length
    if (y + mm(14) > printableBottom) { doc.addPage(); addFooter(); y = PAGE_MARGIN }
    doc.font(FONT_BOLD).fontSize(12).fillColor('black')
      .text(`${nodeLabel(sw)}${sw.is_main ? '  (Hauptswitch)' : ''}`, PAGE_MARGIN, y, { lineBreak: false })
    doc.font(FONT_NORMAL).fontSize(9).fillColor('#666666')
      .text(sw.port_count ? `${used}/${sw.port_count} Ports belegt` : 'Keine Portanzahl hinterlegt', PAGE_MARGIN, y + mm(5.5), { lineBreak: false })
    doc.fillColor('black')
    y += mm(12)

    if (!sw.port_count) continue

    y = drawRow(doc, y, usableW, portCols, true)

    for (let port = 1; port <= sw.port_count; port++) {
      const conn = connections.find(c => {
        const field = connFieldForNode(c, sw.id)
        if (!field) return false
        return String(field === 'from' ? c.from_port : c.to_port) === String(port)
      })
      if (!conn) continue // freie Ports werden im PDF nicht extra aufgelistet
      const field = connFieldForNode(conn, sw.id)
      const targetId = field === 'from' ? conn.to_node_id : conn.from_node_id
      const targetPort = field === 'from' ? conn.to_port : conn.from_port
      const target = byId.get(targetId)
      const rowCols = [
        { text: String(port), w: portCols[0].w, bold: true },
        { text: nodeLabel(target), w: portCols[1].w },
        { text: target?.type === 'switch' && targetPort ? String(targetPort) : '—', w: portCols[2].w },
      ]
      if (y + ROW_MIN_H > printableBottom) {
        doc.addPage(); addFooter(); y = PAGE_MARGIN
        y = drawRow(doc, y, usableW, portCols, true)
      }
      y = drawRow(doc, y, usableW, rowCols, false)
    }
    y += mm(6)
  }

  const otherConnections = connections.filter(c =>
    byId.get(c.from_node_id)?.type !== 'switch' && byId.get(c.to_node_id)?.type !== 'switch'
  )
  if (otherConnections.length) {
    if (y + mm(14) > printableBottom) { doc.addPage(); addFooter(); y = PAGE_MARGIN }
    doc.font(FONT_BOLD).fontSize(12).fillColor('black').text('Sonstige Verbindungen', PAGE_MARGIN, y, { lineBreak: false })
    y += mm(8)
    const otherCols = [
      { text: 'Von', w: usableW / 2 },
      { text: 'Zu', w: usableW / 2 },
    ]
    y = drawRow(doc, y, usableW, otherCols, true)
    for (const conn of otherConnections) {
      const rowCols = [
        { text: nodeLabel(byId.get(conn.from_node_id)), w: otherCols[0].w },
        { text: nodeLabel(byId.get(conn.to_node_id)), w: otherCols[1].w },
      ]
      if (y + ROW_MIN_H > printableBottom) {
        doc.addPage(); addFooter(); y = PAGE_MARGIN
        y = drawRow(doc, y, usableW, otherCols, true)
      }
      y = drawRow(doc, y, usableW, rowCols, false)
    }
  }

  doc.end()
}

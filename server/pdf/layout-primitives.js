import { mm, PAGE_MARGIN, FONT_NORMAL, FONT_BOLD, COLOR_SWATCH_R, MAX_ROW_H, ROW_MIN_H } from './constants.js'
import { leeHex } from './filter-colors.js'

export function calcRowHeight(doc, cols, minH = ROW_MIN_H) {
  doc.font(FONT_NORMAL).fontSize(8)
  let maxH = minH
  for (const col of cols) {
    if (!col.wrap || !col.text) continue
    const w = col.w - mm(2)
    if (w <= 0) continue
    const h = doc.heightOfString(col.text, { width: w }) + mm(2.6)
    if (h > maxH) maxH = h
  }
  return Math.min(maxH, MAX_ROW_H)
}

export function drawRow(doc, y, usableW, cols, { isHeader = false, minRowH = ROW_MIN_H } = {}) {
  const rowH = isHeader ? ROW_MIN_H : calcRowHeight(doc, cols, minRowH)

  // Hintergrund Header: sehr helles Grau, keine Außenbox
  if (isHeader) {
    doc.rect(PAGE_MARGIN, y, usableW, rowH).fill('#f4f4f4')
    doc.fill('black')
  }

  // Nur obere + untere Linie (keine Seitenrahmen)
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + usableW, y).stroke('#dddddd')
  doc.moveTo(PAGE_MARGIN, y + rowH).lineTo(PAGE_MARGIN + usableW, y + rowH).stroke('#dddddd')

  let x = PAGE_MARGIN
  for (const col of cols) {
    const textX = x + mm(1.5)
    const textW = col.w - mm(3)
    const FONT_SIZE = isHeader ? 7 : 8
    doc.font(FONT_NORMAL).fontSize(FONT_SIZE)

    if (isHeader) {
      // Header: normale Schrift, grau, vertikal zentriert
      const textH = doc.currentLineHeight()
      const textY = y + (rowH - textH) / 2
      doc.fillColor('#666666')
        .text(col.text || '', textX, textY, { width: textW, lineBreak: false, ellipsis: true })
      doc.fillColor('black')
    } else if (col.bold) {
      // Kanal-Nummer: fett, vertikal zentriert
      doc.font(FONT_BOLD).fontSize(FONT_SIZE)
      const textH = doc.currentLineHeight()
      const textY = y + (rowH - textH) / 2
      doc.fillColor('black')
        .text(col.text || '', textX, textY, { width: textW, lineBreak: false, ellipsis: true })
    } else if (col.color !== undefined) {
      // Filter-Spalte: Kreis + Code
      const hex = leeHex(col.color)
      const cy = y + rowH / 2
      if (hex) {
        const cx = x + COLOR_SWATCH_R + mm(1.5)
        doc.circle(cx, cy, COLOR_SWATCH_R).fill(hex)
        // dünner Ring
        doc.save().circle(cx, cy, COLOR_SWATCH_R).lineWidth(0.3).stroke('#aaaaaa').restore()
        doc.fill('black')
        const codeX = cx + COLOR_SWATCH_R + mm(1)
        const textH = doc.font(FONT_NORMAL).fontSize(FONT_SIZE).currentLineHeight()
        const textY = y + (rowH - textH) / 2
        doc.fillColor('black')
          .text(col.text || '', codeX, textY, {
            width: col.w - (codeX - x) - mm(1),
            lineBreak: false, ellipsis: true,
          })
      } else {
        // Kein bekannter Lee-Filter: Text zentriert, dezent grau
        const textH = doc.currentLineHeight()
        const textY = y + (rowH - textH) / 2
        doc.fillColor(col.text ? '#444444' : '#aaaaaa')
          .text(col.text || '—', textX, textY, { width: textW, lineBreak: false, ellipsis: true })
        doc.fillColor('black')
      }
    } else if (col.wrap) {
      // Mehrzeilige Spalten: vertikal oben ausrichten mit Padding
      const textY = y + mm(1.5)
      doc.fillColor('black')
        .text(col.text || '', textX, textY, { width: textW, lineBreak: true })
    } else {
      // Standard: vertikal zentriert
      const textH = doc.currentLineHeight()
      const textY = y + (rowH - textH) / 2
      doc.fillColor('black')
        .text(col.text || '', textX, textY, { width: textW, lineBreak: false, ellipsis: true })
    }
    x += col.w
  }
  return y + rowH
}

export const drawHeaderRow = (doc, y, usableW, cols) => drawRow(doc, y, usableW, cols, { isHeader: true })

// Liest Seitenmaße bei jedem Aufruf neu (statt einmal beim Erzeugen) — nötig,
// weil einzelne Seiten (z.B. der Grundriss-Export) eine andere Ausrichtung/
// Größe als der Rest des Dokuments haben können.
export function createFooter(doc, label) {
  let pageNum = 0
  return function addFooter() {
    pageNum++
    const curUsableW = doc.page.width - PAGE_MARGIN * 2
    const fy = doc.page.height - PAGE_MARGIN - mm(4)
    // doc.y temporär weit oben setzen, damit pdfkit kein continueOnNewPage auslöst
    const savedY = doc.y
    doc.y = PAGE_MARGIN
    doc.font(FONT_NORMAL).fontSize(7).fillColor('#888888')
      .text(label, PAGE_MARGIN, fy, { width: curUsableW / 2, lineBreak: false })
    doc.text(`Seite ${pageNum}`, PAGE_MARGIN + curUsableW / 2, fy, {
      width: curUsableW / 2, align: 'right', lineBreak: false,
    })
    doc.fillColor('black')
    doc.y = savedY
  }
}

// Gemeinsamer Renderer für Label/Wert-Zeilen (KV-Tabelle und Fields-Sektion
// unterscheiden sich nur darin, woher label/value kommen — siehe unten).
function renderLabelValueRows(doc, rows, margin, usableW) {
  const colLabelW = mm(45)
  const colValueW = usableW - colLabelW
  const rowH = mm(5.5)
  let y = doc.y
  for (const { label, value } of rows) {
    if (!value) continue
    doc.rect(margin, y, usableW, rowH).stroke('#cccccc')
    doc.font(FONT_BOLD).fontSize(8)
      .text(label ?? '', margin + mm(1.5), y + mm(1.2), {
        width: colLabelW - mm(3), height: rowH - mm(1), lineBreak: false, ellipsis: true,
      })
    doc.font(FONT_NORMAL).fontSize(8)
      .text(value, margin + colLabelW + mm(1.5), y + mm(1.2), {
        width: colValueW - mm(3), height: rowH - mm(1), lineBreak: false, ellipsis: true,
      })
    y += rowH
  }
  doc.y = y
  doc.moveDown(0.3)
}

export function renderFieldsSection(doc, fields, raw, margin, usableW) {
  const rows = fields.map(field => {
    const escapedKey = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${escapedKey}:\\s*(.*)$`, 'm')
    const match = raw.match(re)
    return {
      label: field.label + (field.unit ? ` (${field.unit})` : ''),
      value: match ? match[1].trim() : '',
    }
  })
  renderLabelValueRows(doc, rows, margin, usableW)
}

export function renderKvTableSection(doc, rows, margin, usableW) {
  renderLabelValueRows(doc, rows.map(row => ({ label: row.label, value: row.value?.trim() ?? '' })), margin, usableW)
}

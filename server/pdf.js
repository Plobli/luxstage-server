/**
 * pdf.js — Einleuchtplan PDF-Export
 * Layout entspricht dem bisherigen Word-Plan:
 * Kanäle nach Position gruppiert, mit Abschnitts-Überschriften
 */
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import { mm, PAGE_MARGIN, COL, GROUP_H, ROW_MIN_H, FONT_NORMAL, FONT_BOLD } from './pdf/constants.js'
import { calcRowHeight, drawRow, renderFieldsSection, renderKvTableSection } from './pdf/layout-primitives.js'
import { parseSetupSection, renderSetupBlocks } from './pdf/tiptap-parse.js'
import { drawTowerCards, renderGassenturmText } from './pdf/towers.js'
import { renderHangereiBars, drawBarRows } from './pdf/bars.js'
import { groupByPosition, fmt } from './pdf/utils.js'
import { drawFloorplanVector } from './pdf/floorplan-vector.js'

// show: { name, datum, template, ... }
// channels: [{ channel, address, device, position, color, notes }]
// sectionsMap: Map<sectionId, contentString>  (from db.readShowSections)
// templateSections: [{ id, title, order, type }]
// photoEntries: [{ path, caption }]  — Fotos mit optionaler Beschreibung
// floorplan: { imagePath, canvasData } — optionaler Grundriss
// photosPerPage: Fotos je Druckseite (1, 2, 4, 6, 8, 9 oder 12)
export async function generatePDF(show, channels, sectionsMap, templateSections, photoEntries, res, floorplan = null, unit = 'm', photosPerPage = 4, opts = {}) {
  const blank = opts.blank === true
  const blankExtraRows = opts.blankExtraRows ?? 4
  const fm = { name: show.name, datum: show.datum, venue: show.template }
  const grouped = groupByPosition(channels)

  const hasSections = Array.isArray(templateSections) && templateSections.length > 0
  const sectionContents = hasSections ? sectionsMap : null
  const sortedSections = hasSections
    ? [...templateSections].sort((a, b) => a.order - b.order)
    : null

  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: PAGE_MARGIN, autoFirstPage: true })
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${blank ? 'kreisliste-vordruck' : 'einleuchtplan'}-${fm.name || 'show'}.pdf"`,
    'Referrer-Policy': 'no-referrer',
  })
  doc.pipe(res)

  const pageW = doc.page.width
  const pageH = doc.page.height
  const usableW = pageW - PAGE_MARGIN * 2
  COL.notes = usableW - COL.channel - COL.color - COL.address - COL.device

  const FOOTER_H = mm(8)
  const printableBottom = pageH - PAGE_MARGIN - FOOTER_H

  // Fußzeile auf jede Seite zeichnen
  const printedAt = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
  let pageNum = 0
  function addFooter() {
    pageNum++
    const curPageH = doc.page.height
    const curPageW = doc.page.width
    const curUsableW = curPageW - PAGE_MARGIN * 2
    const fy = curPageH - PAGE_MARGIN - mm(4)
    // doc.y temporär weit oben setzen damit pdfkit kein continueOnNewPage auslöst
    const savedY = doc.y
    doc.y = PAGE_MARGIN
    doc.font(FONT_NORMAL).fontSize(7).fillColor('#888888')
      .text(`${fm.name || ''} — ${fmt(fm.datum)}`, PAGE_MARGIN, fy, { width: curUsableW / 2, lineBreak: false })
    doc.text(`Seite ${pageNum}`, PAGE_MARGIN + curUsableW / 2, fy, {
      width: curUsableW / 2, align: 'right', lineBreak: false
    })
    doc.fillColor('black')
    doc.y = savedY
  }
  addFooter()

  // ── Titel ────────────────────────────────────────────────────────────────
  doc.font(FONT_BOLD).fontSize(16).fillColor('black')
    .text(`${blank ? 'Kreisliste — Vordruck' : 'Einleuchtplan'} — ${fm.name || ''}`, PAGE_MARGIN, PAGE_MARGIN)
  doc.font(FONT_NORMAL).fontSize(10)
    .text(fm.venue ? `${fm.venue}   |   ${fmt(fm.datum)}` : fmt(fm.datum), PAGE_MARGIN, PAGE_MARGIN + mm(8))
  doc.moveDown(1.5)

  // ── Sections ─────────────────────────────────────────────────────────────
  if (blank) {
    // Vordruck: keine Aufbau-/Sections-Texte, nur die auszufüllende Kreisliste
  } else if (hasSections) {
    for (const sec of sortedSections) {
      const content = sectionContents.get(sec.id) ?? ''
      const hasContent = sec.type === 'kv-table'
        ? (sec.rows ?? []).some(r => r.value?.trim())
        : sec.type === 'fields'
          ? (sec.fields ?? []).some(f => { const m = content.match(new RegExp(`^${f.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(.+)$`, 'm')); return m?.[1]?.trim() })
          : parseSetupSection(content).length > 0
      if (!hasContent) continue
      doc.font(FONT_BOLD).fontSize(11).text(sec.title, PAGE_MARGIN, doc.y)
      doc.moveDown(0.4)
      if (sec.type === 'kv-table') {
        renderKvTableSection(doc, sec.rows ?? [], PAGE_MARGIN, usableW)
      } else if (sec.type === 'fields') {
        renderFieldsSection(doc, sec.fields, content, PAGE_MARGIN, usableW)
      } else {
        const blocks = parseSetupSection(content)
        if (blocks.length) renderSetupBlocks(doc, blocks, PAGE_MARGIN, usableW)
      }
      doc.moveDown(1)
    }
  } else {
    const setupBlocks = parseSetupSection((show.setup_markdown ?? '').replace(/^---\n[\s\S]*?\n---\n/, ''))
    if (setupBlocks.length) {
      doc.font(FONT_BOLD).fontSize(11).text('Aufbau', PAGE_MARGIN, doc.y)
      doc.moveDown(0.5)
      renderSetupBlocks(doc, setupBlocks, PAGE_MARGIN, usableW)
      doc.moveDown(1.5)
    }
  }

  // ── Beleuchtergestelle, Zugstangen & Hängerei ────────────────────────────
  const towers = floorplan?.towers ?? []
  const bars = floorplan?.bars ?? []

  if (!blank && (towers.length > 0 || bars.length > 0)) {
    let ty = doc.y

    if (bars.length > 0) {
      doc.font(FONT_BOLD).fontSize(13).fillColor('black').text('Obermaschinerie', PAGE_MARGIN, ty, { lineBreak: false })
      ty += mm(9)
      ty = renderHangereiBars(doc, bars, channels, PAGE_MARGIN, usableW, ty, printableBottom, addFooter)
      ty += mm(5)
      const barsWithFixtures = bars.filter(bar => (bar.fixtures ?? []).length > 0)
      ty = drawBarRows(doc, barsWithFixtures, channels, PAGE_MARGIN, usableW, ty, printableBottom, addFooter, unit)
      ty += mm(8)
    }

    if (towers.length > 0) {
      if (ty + mm(30) > printableBottom) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }
      doc.font(FONT_BOLD).fontSize(13).fillColor('black').text('Beleuchtungsgestelle', PAGE_MARGIN, ty, { lineBreak: false })
      ty += mm(9)
      ty = renderGassenturmText(doc, towers, channels, PAGE_MARGIN, usableW, ty, printableBottom, addFooter)
      ty += mm(5)
      drawTowerCards(doc, towers, channels, PAGE_MARGIN, usableW, ty, printableBottom, addFooter)
    }
  }

  // ── Kanalliste (immer neue Seite) ─────────────────────────────────────────
  doc.addPage()
  addFooter()

  const headerCols = [
    { text: 'Ch',      w: COL.channel },
    { text: 'Filter',  w: COL.color,   color: undefined }, // color key present → Filter-Spalte, aber isHeader überschreibt
    { text: 'Adresse', w: COL.address },
    { text: 'Gerät',   w: COL.device },
    { text: 'Notizen', w: COL.notes },
  ]

  let y = PAGE_MARGIN
  for (const [position, rows] of grouped) {
    const filteredRows = blank ? rows : rows.filter(r => r.notes?.trim())
    if (!blank && !filteredRows.length) continue

    // Präventiver Seitenumbruch: Überschrift + Spaltenheader + mind. 1 Zeile müssen passen
    const minNeeded = GROUP_H + ROW_MIN_H + ROW_MIN_H
    if (y + minNeeded > printableBottom) {
      doc.addPage()
      addFooter()
      y = PAGE_MARGIN
    }

    // Positions-Überschrift — dezent: kleine graue Trennlinie statt dunkler Block
    doc.rect(PAGE_MARGIN, y, usableW, GROUP_H).fill('#f0f0f0')
    doc.fill('#555555').font(FONT_BOLD).fontSize(7.5)
      .text(position.toUpperCase(), PAGE_MARGIN + mm(2), y + mm(1.6), { width: usableW - mm(4) })
    doc.fill('black')
    y += GROUP_H

    // Spalten-Header
    y = drawRow(doc, y, usableW, headerCols, true)

    // Datenzeilen — im Vordruck: Ch/Adresse/Gerät vorgedruckt, Filter/Notizen
    // leer zum handschriftlichen Ausfüllen; zusätzlich Leerzeilen für neue Kreise
    const dataRows = blank
      ? [...filteredRows, ...Array.from({ length: blankExtraRows }, () => ({ channel: '', address: '', device: '' }))]
      : filteredRows
    for (const row of dataRows) {
      const rowCols = blank
        ? [
            { text: row.channel, w: COL.channel, bold: true },
            { text: '',          w: COL.color },
            { text: row.address, w: COL.address, wrap: true },
            { text: row.device,  w: COL.device,  wrap: true },
            { text: '',          w: COL.notes, wrap: true },
          ]
        : [
            { text: row.channel, w: COL.channel, bold: true },
            { text: row.color,   w: COL.color,   color: row.color },
            { text: row.address, w: COL.address, wrap: true },
            { text: row.device,  w: COL.device,  wrap: true },
            { text: row.notes,   w: COL.notes,   wrap: true },
          ]
      const rowH = calcRowHeight(doc, rowCols, blank ? mm(9) : ROW_MIN_H)
      if (y + rowH > printableBottom) {
        doc.addPage()
        addFooter()
        y = PAGE_MARGIN
        // Gruppen-Header wiederholen
        doc.rect(PAGE_MARGIN, y, usableW, GROUP_H).fill('#f0f0f0')
        doc.fill('#555555').font(FONT_BOLD).fontSize(7.5)
          .text(`${position.toUpperCase()} (Forts.)`, PAGE_MARGIN + mm(2), y + mm(1.6))
        doc.fill('black')
        y += GROUP_H
        y = drawRow(doc, y, usableW, headerCols, true)
      }
      y = drawRow(doc, y, usableW, rowCols, false, blank ? mm(9) : ROW_MIN_H)
      await new Promise(resolve => setImmediate(resolve))
    }
    y += mm(3)
  }

  // ── Vordruck: Leerzeilen-Block für komplett neue Positionen/Kreise ────────
  if (blank) {
    const minNeeded = GROUP_H + ROW_MIN_H + ROW_MIN_H
    if (y + minNeeded > printableBottom) {
      doc.addPage()
      addFooter()
      y = PAGE_MARGIN
    }
    doc.rect(PAGE_MARGIN, y, usableW, GROUP_H).fill('#f0f0f0')
    doc.fill('#555555').font(FONT_BOLD).fontSize(7.5)
      .text('NEUE KREISE / ZUSÄTZLICHER AUFBAU', PAGE_MARGIN + mm(2), y + mm(1.6), { width: usableW - mm(4) })
    doc.fill('black')
    y += GROUP_H
    y = drawRow(doc, y, usableW, headerCols, true)

    const emptyRowCols = [
      { text: '', w: COL.channel, bold: true },
      { text: '', w: COL.color },
      { text: '', w: COL.address, wrap: true },
      { text: '', w: COL.device, wrap: true },
      { text: '', w: COL.notes, wrap: true },
    ]
    for (let i = 0; i < (opts.newCircuitRows ?? 15); i++) {
      if (y + mm(9) > printableBottom) {
        doc.addPage()
        addFooter()
        y = PAGE_MARGIN
        doc.rect(PAGE_MARGIN, y, usableW, GROUP_H).fill('#f0f0f0')
        doc.fill('#555555').font(FONT_BOLD).fontSize(7.5)
          .text('NEUE KREISE / ZUSÄTZLICHER AUFBAU (Forts.)', PAGE_MARGIN + mm(2), y + mm(1.6))
        doc.fill('black')
        y += GROUP_H
        y = drawRow(doc, y, usableW, headerCols, true)
      }
      y = drawRow(doc, y, usableW, emptyRowCols, false, mm(9))
    }
  }

  // ── Grundriss ─────────────────────────────────────────────────────────────
  // Nur anzeigen wenn echte Canvas-Objekte vorhanden (nicht nur Hintergrundbild)
  const hasCanvasObjects = (() => {
    if (!floorplan?.canvasData) return false
    try {
      const parsed = typeof floorplan.canvasData === 'string' ? JSON.parse(floorplan.canvasData) : floorplan.canvasData
      const elements = Array.isArray(parsed) ? parsed : parsed?.elements
      return Array.isArray(elements) && elements.length > 0
    } catch { return false }
  })()

  if (!blank && floorplan?.canvasData && hasCanvasObjects) {
    doc.addPage()
    addFooter()

    doc.font(FONT_BOLD).fontSize(13).fillColor('black')
      .text('Grundriss', PAGE_MARGIN, PAGE_MARGIN, { lineBreak: false })

    const imgY = PAGE_MARGIN + mm(12)
    const imgMaxH = pageH - imgY - PAGE_MARGIN - mm(8)

    try {
      drawFloorplanVector(doc, {
        canvasData: floorplan.canvasData,
        towers: floorplan.towers,
        bars: floorplan.bars,
        channels,
        imagePath: floorplan.imagePath,
      }, { x: PAGE_MARGIN, y: imgY, width: usableW, height: imgMaxH })
    } catch (err) {
      doc.font(FONT_NORMAL).fontSize(9).fillColor('#888888')
        .text(`Grundriss-Fehler: ${err?.message ?? err}`, PAGE_MARGIN, imgY, { width: usableW })
    }
  }

  // ── Foto-Abschnitt ────────────────────────────────────────────────────────
  const validPhotos = (photoEntries ?? []).filter(e => {
    try { fs.accessSync(e.path); return true } catch { return false }
  })

  if (!blank && validPhotos.length > 0) {
    doc.addPage()
    addFooter()
    y = PAGE_MARGIN

    // Überschrift
    doc.font(FONT_BOLD).fontSize(13).fillColor('black')
      .text('Fotos', PAGE_MARGIN, y)
    y += mm(10)

    // Spaltenzahl wie in der Browser-Druckansicht (PhotoGallery.vue), damit
    // dieselbe Einstellung in beiden Ausgaben dasselbe Raster ergibt.
    const PHOTOS_PER_PAGE = photosPerPage
    const COLS = PHOTOS_PER_PAGE === 1 ? 1 : PHOTOS_PER_PAGE <= 4 ? 2 : 3
    const ROWS = Math.ceil(PHOTOS_PER_PAGE / COLS)
    const PHOTO_GAP = mm(6)
    const CAPTION_H = mm(8)
    const photoW = (usableW - PHOTO_GAP) / COLS
    const photoH = (printableBottom - y - (ROWS - 1) * PHOTO_GAP - ROWS * CAPTION_H) / ROWS

    let col = 0
    let row = 0
    let photoOnPage = 0

    for (let i = 0; i < validPhotos.length; i++) {
      if (photoOnPage > 0 && photoOnPage % PHOTOS_PER_PAGE === 0) {
        doc.addPage()
        addFooter()
        y = PAGE_MARGIN
        row = 0
        col = 0
      }

      const x = PAGE_MARGIN + col * (photoW + PHOTO_GAP)
      const imgY = y + row * (photoH + CAPTION_H + PHOTO_GAP)

      try {
        doc.image(validPhotos[i].path, x, imgY, { width: photoW, height: photoH, fit: [photoW, photoH], align: 'center', valign: 'center' })
      } catch { /* Bild nicht lesbar → überspringen */ }

      // Beschriftung unter dem Foto
      const caption = validPhotos[i].caption?.trim() ?? ''
      if (caption) {
        doc.font(FONT_NORMAL).fontSize(7.5).fillColor('#444444')
          .text(caption, x, imgY + photoH + mm(1.5), { width: photoW, lineBreak: false, ellipsis: true })
        doc.fillColor('black')
      }

      col++
      if (col >= COLS) { col = 0; row++ }
      photoOnPage++
    }
  }

  doc.end()
}

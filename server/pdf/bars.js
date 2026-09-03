import { mm, PAGE_MARGIN, FONT_NORMAL, FONT_BOLD, BAR_TYPE_LABELS } from './constants.js'
import { fmtLeeColorLabel as fmtColor } from './filter-colors.js'

// Hängerei als Textliste (eine Zeile pro Zug)
export function renderHangereiBars(doc, bars, channels, margin, usableW, startY, bottomLimit, addFooter) {
  let ty = startY

  const sorted = [...bars].sort((a, b) => a.sort_order - b.sort_order)
  for (const bar of sorted) {
    const fixtures = bar.fixtures ?? []
    if (!fixtures.length && !bar.notes) continue
    if (!fixtures.length) {
      const lineH = doc.font(FONT_NORMAL).fontSize(8.5).heightOfString(bar.notes, { width: usableW }) + mm(1)
      if (ty + lineH > bottomLimit) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }
      const nameLabel = `${bar.name}: `
      doc.font(FONT_BOLD).fontSize(8.5).fillColor('black')
        .text(nameLabel, margin, ty, { continued: true, lineBreak: false })
      doc.font(FONT_NORMAL).text(bar.notes, { width: usableW - doc.widthOfString(nameLabel), lineBreak: true })
      ty += lineH + mm(1)
      continue
    }

    const fixSorted = [...fixtures].sort((a, b) => a.position - b.position)
    const parts = fixSorted.map(fx => {
      const ch = channels.find(c => c.id === fx.channel_id)
      const tokens = [`V.${ch?.channel ?? '?'}`, ch?.device, ch?.address ? `#${ch.address}` : undefined, fmtColor(ch?.color), fx.notes || undefined]
      if (!bar.hide_scale) {
        const cm = fx.position
        let posStr
        if (cm === 0) posStr = 'Mitte'
        else {
          const val = Math.abs(cm) / 100
          const valStr = Number.isInteger(val) ? val : parseFloat(val.toFixed(2))
          posStr = `${valStr}m ${cm < 0 ? 'Links' : 'Rechts'}`
        }
        tokens.push(posStr)
      }
      return tokens.filter(Boolean).join(' ')
    })
    let line = `${bar.name}: ${parts.join(' • ')}`
    if (bar.notes) line += ` • ${bar.notes}`

    // Seitenumbruch
    const lineH = doc.font(FONT_NORMAL).fontSize(8.5).heightOfString(line, { width: usableW }) + mm(1)
    if (ty + lineH > bottomLimit) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }

    const nameLabel = `${bar.name}: `
    doc.font(FONT_BOLD).fontSize(8.5).fillColor('black')
      .text(nameLabel, margin, ty, { continued: true, lineBreak: false })
    const rest = line.slice(nameLabel.length)
    doc.font(FONT_NORMAL)
      .text(rest, { width: usableW - doc.widthOfString(nameLabel), lineBreak: true })
    ty += lineH + mm(1)
  }
  return ty
}

export function cmToDisplayUnit(cm, unit) {
  if (unit === 'mm') return `${Math.round(cm * 10)} mm`
  if (unit === 'cm') return `${Math.round(cm)} cm`
  return `${Math.round(cm / 100 * 100) / 100} m`
}

export function posLabel(cm, unit) {
  const abs = Math.abs(cm)
  let val
  if (unit === 'mm') val = Math.round(abs * 10)
  else if (unit === 'cm') val = Math.round(abs)
  else val = Math.round(abs / 100 * 100) / 100
  if (cm === 0) return '0'
  return cm > 0 ? `+${val}` : `-${val}`
}

// Punktzug: kompakte Zeile ohne Längen-Skala — Freitext-Position + ein Kreis
function drawPunktzugRow(doc, bar, fx, channels, margin, usableW, startY, bottomLimit, addFooter) {
  const CIRCLE_R = mm(3.2)
  const hasNotes = !!(bar.notes && bar.notes.trim())
  const ROW_H = mm(hasNotes ? 20 : 15)

  let ty = startY
  if (ty + ROW_H > bottomLimit) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }

  doc.roundedRect(margin, ty, usableW, ROW_H, 4).fillAndStroke('#f5f5f5', '#cccccc')
  doc.fillColor('black')

  doc.font(FONT_BOLD).fontSize(11).fillColor('#111111')
    .text(bar.name ?? '', margin + mm(4), ty + mm(3), { width: mm(48), lineBreak: false, ellipsis: true })
  doc.font(FONT_NORMAL).fontSize(7.5).fillColor('#888888')
    .text(BAR_TYPE_LABELS.punktzug, margin + mm(4), ty + mm(9), { width: mm(48), lineBreak: false })

  const posX = margin + mm(56)
  const posW = usableW - mm(56) - mm(16)
  if (fx?.position_text) {
    doc.font(FONT_NORMAL).fontSize(8).fillColor('#333333')
      .text(fx.position_text, posX, ty + mm(6), { width: posW, lineBreak: false, ellipsis: true })
  }

  if (fx) {
    const cx = margin + usableW - mm(10)
    const cy = ty + mm(7.5)
    const ch = channels.find(c => c.id === fx.channel_id)
    doc.circle(cx, cy, CIRCLE_R + 0.5).fill('rgba(220,55,64,0.18)')
    doc.circle(cx, cy, CIRCLE_R).fill('#dc3740')
    doc.font(FONT_BOLD).fontSize(7.5).fillColor('white')
    const textH = doc.currentLineHeight()
    doc.text(String(ch?.channel ?? '?'), cx - CIRCLE_R, cy - textH / 2, { width: CIRCLE_R * 2, align: 'center', lineBreak: false })
    doc.fillColor('black')
    if (fx.notes) doc.circle(cx + CIRCLE_R * 0.7, cy - CIRCLE_R * 0.7, mm(1.2)).fill('#f59e0b')
  }

  if (hasNotes) {
    doc.font(FONT_NORMAL).fontSize(7).fillColor('#000000')
      .text(bar.notes, margin + mm(4), ty + ROW_H - mm(6), { width: usableW - mm(8), lineBreak: false, ellipsis: true })
  }

  return ty + ROW_H + mm(4)
}

// Zugstangen als visuelle Zeilen mit Kanal-Kreisen
export function drawBarRows(doc, bars, channels, margin, usableW, startY, bottomLimit, addFooter, unit = 'm') {
  const CIRCLE_R = mm(3.2)
  const LEFT_COL = mm(48)   // Breite linke Infospalte
  const GAP = mm(4)

  let ty = startY
  for (const bar of bars) {
    const fixtures = bar.fixtures ?? []
    const barLenCm = bar.length_cm || 600
    const hasNotes = !!(bar.notes && bar.notes.trim())

    if (bar.bar_type === 'punktzug') {
      ty = drawPunktzugRow(doc, bar, fixtures[0], channels, margin, usableW, ty, bottomLimit, addFooter)
      continue
    }

    // Höhe dynamisch: Basis + ggf. Gerät-Zeilen + ggf. Anmerkung
    // Für jedes Fixture eine Gerätename-Zeile unterhalb des Kreises (nur wenn Device vorhanden)
    const BAR_H = mm(hasNotes ? 46 : 42)

    if (ty + BAR_H > bottomLimit) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }

    // Hintergrund
    doc.roundedRect(margin, ty, usableW, BAR_H, 4).fillAndStroke('#f5f5f5', '#cccccc')
    doc.fillColor('black')

    // ── Linke Spalte ──────────────────────────────────────────────────────────
    // Name
    doc.font(FONT_BOLD).fontSize(11).fillColor('#111111')
      .text(bar.name ?? '', margin + mm(4), ty + mm(4), { width: LEFT_COL - mm(6), lineBreak: false, ellipsis: true })

    // Meta: Länge · Höhe · Zugname
    const metaParts = [
      BAR_TYPE_LABELS[bar.bar_type] ?? null,
      bar.length_cm ? `Länge ${cmToDisplayUnit(bar.length_cm, unit)}` : null,
      bar.height_cm != null ? `Höhe ${cmToDisplayUnit(bar.height_cm, unit)}` : null,
      bar.zug_nr ? `Zug ${bar.zug_nr}` : null,
    ].filter(Boolean)
    if (metaParts.length) {
      doc.font(FONT_NORMAL).fontSize(7.5).fillColor('#888888')
        .text(metaParts.join(' · '), margin + mm(4), ty + mm(11), { width: LEFT_COL - mm(6), lineBreak: false })
    }

    // Anzahl Scheinwerfer
    if (fixtures.length > 0) {
      doc.font(FONT_NORMAL).fontSize(7).fillColor('#aaaaaa')
        .text(`${fixtures.length} Scheinwerfer`, margin + mm(4), ty + mm(16.5), { width: LEFT_COL - mm(6), lineBreak: false })
    }

    // ── Stangenlinie ──────────────────────────────────────────────────────────
    const lineLeft = margin + LEFT_COL
    const lineRight = margin + usableW - mm(4)
    const lineY = ty + mm(21)   // Mittelpunkt der Kreise
    const linePx = lineRight - lineLeft

    // Track-Hintergrund
    doc.roundedRect(lineLeft, lineY - mm(0.8), linePx, mm(1.6), mm(0.8)).fill('#cccccc')

    // Grüne Linie
    doc.moveTo(lineLeft, lineY).lineTo(lineRight, lineY).lineWidth(2.5).stroke('#10b981').lineWidth(1)

    // Endmarkierungen
    doc.moveTo(lineLeft, lineY - mm(3)).lineTo(lineLeft, lineY + mm(3)).lineWidth(1.5).stroke('#10b981')
    doc.moveTo(lineRight, lineY - mm(3)).lineTo(lineRight, lineY + mm(3)).lineWidth(1.5).stroke('#10b981')

    // ── Skala-Ticks ───────────────────────────────────────────────────────────
    if (!bar.hide_scale) {
      const half = barLenCm / 2
      const tickStep = barLenCm <= 600 ? 50 : barLenCm <= 1200 ? 100 : 200
      for (let cm = -half; cm <= half + 0.01; cm += tickStep) {
        const snapped = Math.round(cm)
        const pct = (snapped + half) / barLenCm
        const tx = lineLeft + pct * linePx
        const isCenter = snapped === 0
        const tickH = isCenter ? mm(4) : mm(2.5)
        doc.moveTo(tx, lineY - tickH / 2).lineTo(tx, lineY + tickH / 2)
          .lineWidth(isCenter ? 1.5 : 0.75).stroke(isCenter ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)')
        // Label oberhalb
        const label = posLabel(snapped, unit)
        doc.font(FONT_NORMAL).fontSize(5.5).fillColor(isCenter ? '#444444' : '#aaaaaa')
          .text(label, tx - mm(6), lineY - tickH / 2 - mm(4.5), { width: mm(12), align: 'center', lineBreak: false })
      }
    }

    // ── Fixture-Circles ───────────────────────────────────────────────────────
    for (const fx of fixtures) {
      const posFrac = (fx.position + barLenCm / 2) / barLenCm
      const cx = lineLeft + posFrac * linePx
      const ch = channels.find(c => c.id === fx.channel_id)
      const nr = ch?.channel ?? '?'
      const device = ch?.device ?? ''

      // Kreis mit Schatten-Effekt (leichter Rand)
      doc.circle(cx, lineY, CIRCLE_R + 0.5).fill('rgba(220,55,64,0.18)')
      doc.circle(cx, lineY, CIRCLE_R).fill('#dc3740')

      // Kanalnummer zentriert im Kreis
      doc.font(FONT_BOLD).fontSize(7.5).fillColor('white')
      const textH = doc.currentLineHeight()
      doc.text(String(nr), cx - CIRCLE_R, lineY - textH / 2, { width: CIRCLE_R * 2, align: 'center', lineBreak: false })
      doc.fillColor('black')

      // Positionslabel unterhalb Kreis (nur wenn Skala nicht ausgeblendet)
      const deviceY = bar.hide_scale ? lineY + CIRCLE_R + mm(1.5) : lineY + CIRCLE_R + mm(5.5)
      if (!bar.hide_scale) {
        doc.font(FONT_NORMAL).fontSize(6).fillColor('#555555')
          .text(posLabel(fx.position, unit), cx - mm(7), lineY + CIRCLE_R + mm(1.5), { width: mm(14), align: 'center', lineBreak: false })
      }

      // Gerätename unter Positionslabel
      if (device) {
        doc.font(FONT_NORMAL).fontSize(5.5).fillColor('#999999')
          .text(device, cx - mm(10), deviceY, { width: mm(20), align: 'center', lineBreak: false, ellipsis: true })
      }

      // Anmerkungs-Marker (kleiner Punkt oben rechts am Kreis, wie gelber Ring in WebApp)
      if (fx.notes) {
        doc.circle(cx + CIRCLE_R * 0.7, lineY - CIRCLE_R * 0.7, mm(1.2)).fill('#f59e0b')
      }

      // Innen/Außen-Kennzeichnung bei Traversen
      if (bar.bar_type === 'traverse') {
        doc.font(FONT_BOLD).fontSize(5).fillColor('#666666')
          .text(fx.side === 'in' ? 'I' : 'A', cx - CIRCLE_R, lineY - CIRCLE_R - mm(3.5), { width: CIRCLE_R * 2, align: 'center', lineBreak: false })
        doc.fillColor('black')
      }
    }

    // ── Anmerkung zur Zugstange ───────────────────────────────────────────────
    if (hasNotes) {
      const notesY = ty + BAR_H - mm(9)
      doc.font(FONT_NORMAL).fontSize(7).fillColor('#000000')
        .text(bar.notes, lineLeft, notesY + mm(1.5), { width: linePx, lineBreak: false, ellipsis: true })
    }

    ty += BAR_H + GAP
  }
  return ty
}

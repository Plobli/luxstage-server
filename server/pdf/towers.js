import { mm, PAGE_MARGIN, FONT_NORMAL, FONT_BOLD } from './constants.js'
import { leeHex, contrastColor, fmtLeeColorLabel as fmtColor } from './filter-colors.js'

// Gassentürme als Karten-Grid (3 Spalten), Slots vertikal von oben nach unten
export function drawTowerCards(doc, towers, channels, margin, usableW, startY, bottomLimit, addFooter) {
  const COLS = 3
  const GAP = mm(4)
  const cardW = (usableW - GAP * (COLS - 1)) / COLS
  const CARD_PAD = mm(3)
  const CARD_HEADER_H = mm(10)
  const SLOT_H = mm(6.5)
  const SLOT_NOTE_H = mm(3.5)
  const CIRCLE_R = mm(2.8)
  const TOWER_NOTE_H = mm(6)

  // Kartenhöhe berechnen — inkl. Extra-Zeile je Slot mit Notiz und Turm-Notiz
  function cardHeight(tower) {
    const slots = tower.slots ?? []
    const noteRows = slots.filter(s => s.channel_id && s.notes?.trim()).length
    const towerNoteH = tower.notes?.trim() ? TOWER_NOTE_H : 0
    return CARD_HEADER_H + slots.length * SLOT_H + noteRows * SLOT_NOTE_H + towerNoteH + mm(2)
  }

  let col = 0
  let rowY = startY
  // Höhe der aktuellen Reihe = Maximum der Karten in dieser Reihe
  let rowCards = []

  function flushRow() {
    if (rowCards.length === 0) return
    const maxH = Math.max(...rowCards.map(c => c.h))
    rowY += maxH + GAP
    rowCards = []
    col = 0
  }

  for (const tower of towers) {
    const cardH = cardHeight(tower)

    if (col === 0 && rowY + cardH > bottomLimit) {
      doc.addPage(); addFooter(); rowY = PAGE_MARGIN
    }

    const cx = margin + col * (cardW + GAP)

    // Karten-Rahmen
    doc.roundedRect(cx, rowY, cardW, cardH, 4).fillAndStroke('#f8f8f8', '#dddddd')
    doc.fillColor('black')

    // Header-Hintergrund
    doc.roundedRect(cx, rowY, cardW, CARD_HEADER_H, 4).fill('#eeeeee')
    // untere Ecken gerade machen
    doc.rect(cx, rowY + CARD_HEADER_H - 4, cardW, 4).fill('#eeeeee')
    doc.fillColor('black')

    // Name
    doc.font(FONT_BOLD).fontSize(9).fillColor('#111111')
      .text(tower.name ?? '', cx + CARD_PAD, rowY + mm(2), { width: cardW - CARD_PAD * 2 - mm(12), lineBreak: false, ellipsis: true })

    // Slot-Count oben rechts in Rot
    const filledSlots = (tower.slots ?? []).filter(s => s.channel_id)
    const slotLabel = `${filledSlots.length}/${tower.slot_count ?? tower.slots?.length ?? 0}`
    doc.font(FONT_BOLD).fontSize(7).fillColor('#dc3740')
      .text(slotLabel, cx + cardW - CARD_PAD - mm(12), rowY + mm(2), { width: mm(12), align: 'right', lineBreak: false })

    // Bereich · Seite
    const meta = [tower.stage_area, tower.side].filter(Boolean).join(' · ')
    if (meta) {
      doc.font(FONT_NORMAL).fontSize(6.5).fillColor('#888888')
        .text(meta, cx + CARD_PAD, rowY + mm(6), { width: cardW - CARD_PAD * 2, lineBreak: false, ellipsis: true })
    }

    // Slots vertikal
    const allSlots = [...(tower.slots ?? [])].sort((a, b) => a.slot_index - b.slot_index)
    let sy = rowY + CARD_HEADER_H
    for (const slot of allSlots) {
      const ch = slot.channel_id ? channels.find(c => c.id === slot.channel_id) : null

      // Slot-Trennlinie
      doc.moveTo(cx + mm(1), sy).lineTo(cx + cardW - mm(1), sy).lineWidth(0.3).stroke('#dddddd').lineWidth(1)

      if (ch) {
        // Kanal-Kreis
        const circleCx = cx + mm(6)
        const circleCy = sy + SLOT_H / 2
        doc.circle(circleCx, circleCy, CIRCLE_R).fill('#dc3740')
        doc.font(FONT_BOLD).fontSize(6)
        doc.fillColor('white').text(String(ch.channel), circleCx - CIRCLE_R, circleCy - mm(1.05), { width: CIRCLE_R * 2, align: 'center', lineBreak: false })
        doc.fillColor('black')

        // Farbcode-Badge
        if (ch.color) {
          const hex = leeHex(ch.color)
          const badgeX = cx + mm(11)
          const badgeW = mm(12)
          const badgeH = mm(4)
          const badgeY = sy + (SLOT_H - badgeH) / 2
          if (hex) {
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2).fill(hex)
            const contrast = contrastColor(hex)
            doc.font(FONT_BOLD).fontSize(5.5).fillColor(contrast)
              .text(ch.color, badgeX, badgeY + mm(0.8), { width: badgeW, align: 'center', lineBreak: false })
          } else {
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2).fillAndStroke('#eeeeee', '#cccccc')
            doc.font(FONT_NORMAL).fontSize(5.5).fillColor('#555555')
              .text(ch.color, badgeX, badgeY + mm(0.8), { width: badgeW, align: 'center', lineBreak: false })
          }
          doc.fillColor('black')
        }

        // Gerätename
        const deviceX = cx + mm(25)
        const deviceW = cardW - mm(25) - CARD_PAD
        if (ch.device && deviceW > mm(5)) {
          doc.font(FONT_NORMAL).fontSize(6.5).fillColor('#333333')
            .text(ch.device, deviceX, sy + (SLOT_H - mm(2.5)) / 2, { width: deviceW, lineBreak: false, ellipsis: true })
        }
      } else {
        doc.font(FONT_NORMAL).fontSize(6.5).fillColor('#cccccc')
          .text('—', cx + mm(6), sy + (SLOT_H - mm(2.5)) / 2, { width: cardW - mm(9), lineBreak: false })
      }

      sy += SLOT_H

      // Slot-Notiz als eigene Zeile darunter
      if (ch && slot.notes?.trim()) {
        doc.font(FONT_NORMAL).fontSize(6).fillColor('#666666')
          .text(slot.notes, cx + mm(6), sy + mm(0.3), { width: cardW - mm(6) - CARD_PAD, lineBreak: false, ellipsis: true })
        sy += SLOT_NOTE_H
      }
    }

    // Turm-Notiz am unteren Kartenrand
    if (tower.notes?.trim()) {
      doc.moveTo(cx + mm(1), sy).lineTo(cx + cardW - mm(1), sy).lineWidth(0.3).stroke('#dddddd').lineWidth(1)
      doc.font(FONT_NORMAL).fontSize(6.5).fillColor('#555555')
        .text(tower.notes, cx + mm(2), sy + mm(1.3), { width: cardW - mm(4), lineBreak: false, ellipsis: true })
    }

    rowCards.push({ h: cardH })
    col++
    if (col >= COLS) flushRow()
  }
  flushRow()
  return rowY
}

// Gassentürme als Textliste (eine Zeile pro Turm)
export function renderGassenturmText(doc, towers, channels, margin, usableW, startY, bottomLimit, addFooter) {
  let ty = startY

  const sorted = [...towers].sort((a, b) => a.sort_order - b.sort_order)
  for (const tower of sorted) {
    const filled = [...(tower.slots ?? [])].sort((a, b) => a.slot_index - b.slot_index).filter(s => s.channel_id)
    if (!filled.length) continue

    const header = [tower.name, tower.stage_area, tower.side].filter(Boolean).join(' ')
    const parts = filled.map(slot => {
      const ch = channels.find(c => c.id === slot.channel_id)
      return [`V.${ch?.channel ?? '?'}`, ch?.device, fmtColor(ch?.color), slot.notes?.trim() || undefined].filter(Boolean).join(' ')
    })
    let line = `${header}: ${parts.join(', ')}`
    if (tower.notes?.trim()) line += ` • ${tower.notes}`

    const lineH = doc.font(FONT_NORMAL).fontSize(8.5).heightOfString(line, { width: usableW }) + mm(1)
    if (ty + lineH > bottomLimit) { doc.addPage(); addFooter(); ty = PAGE_MARGIN }

    const nameLabel = `${header}: `
    doc.font(FONT_BOLD).fontSize(8.5).fillColor('black')
      .text(nameLabel, margin, ty, { continued: true, lineBreak: false })
    doc.font(FONT_NORMAL)
      .text(parts.join(', '), { width: usableW - doc.widthOfString(nameLabel), lineBreak: true })
    ty += lineH + mm(1)
  }
  return ty
}

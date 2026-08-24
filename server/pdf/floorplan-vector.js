import fs from 'node:fs'
import { FONT_NORMAL, FONT_BOLD } from './constants.js'
import { readImageSize } from './utils.js'

// Editor-Stage-Größe (web-app/src/components/FloorplanEditor.vue: stageSize),
// A4-Querformat-Druckbereich als Ziel-Seitenverhältnis (267mm x 160mm).
const STAGE_W = 2000
const STAGE_H = Math.round(2000 / (267 / 160))

// Fallback-Werte für die CSS-Variablen, die der Editor für tower-Elemente nutzt
// (siehe web-app/src/utils/floorplanSnapshot.js SNAPSHOT_CSS_VARS — identisches
// Theme-unabhängiges Farbschema für Server-/Print-Kontext).
const COLOR_ACCENT = '#dc3740'
const COLOR_ACCENT_FOREGROUND = '#ffffff'
const COLOR_CARD = '#ffffff'
const COLOR_FOREGROUND = '#0a0a0a'

function parseCanvasData(canvasData) {
  if (!canvasData) return { elements: [] }
  try {
    const parsed = typeof canvasData === 'string' ? JSON.parse(canvasData) : canvasData
    if (Array.isArray(parsed)) return { elements: parsed }
    return { elements: parsed?.elements ?? [] }
  } catch {
    return { elements: [] }
  }
}

// Pfeilspitze für channel-Elemente: Schnittpunkt der Rotationsrichtung mit dem
// Pillenrand + 40px Länge. 1:1 aus FloorplanEditor.vue getArrowPoints() übernommen.
function arrowPoints(pillWidth, rotationDeg) {
  const rad = (rotationDeg || 0) * Math.PI / 180
  const r = 18
  const flatW = pillWidth / 2 - r
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)

  let bx = 0, by = 0
  if (Math.abs(dy) > 0.001) {
    const yEdge = dy > 0 ? r : -r
    const xIntersect = yEdge * dx / dy
    if (xIntersect >= -flatW && xIntersect <= flatW) {
      bx = xIntersect
      by = yEdge
    }
  }
  if (bx === 0 && by === 0) {
    const cx = dx > 0 ? flatW : -flatW
    const B = -2 * dx * cx
    const C = cx * cx - r * r
    const disc = B * B - 4 * C
    if (disc >= 0) {
      const t = (-B + Math.sqrt(disc)) / 2
      bx = t * dx
      by = t * dy
    }
  }
  const len = 40
  return { x1: bx, y1: by, x2: bx + dx * len, y2: by + dy * len }
}

// Fixture-Position auf einer Zugstange, 1:1 aus FloorplanEditor.vue fixtureXOffset().
function fixtureXOffset(positionCm, lengthCm, widthPx) {
  const len = lengthCm || 600
  return ((positionCm + len / 2) / len) * widthPx
}

// Bild unverzerrt (wie CSS object-fit: contain) in ein Zielrechteck einpassen, zentriert.
// 1:1 aus web-app/src/utils/floorplanSnapshot.js containRect() übernommen — das
// Hintergrundbild wird dort genauso INNERHALB der Stage-Koordinaten eingepasst,
// nicht die Stage an das Bild angeglichen. Nur wenn Bild und Vektor-Overlay
// dasselbe Koordinatensystem (Stage-px) teilen, bleiben sie deckungsgleich.
function containRect(imgW, imgH, boxW, boxH) {
  const scale = Math.min(boxW / imgW, boxH / imgH)
  const w = imgW * scale
  const h = imgH * scale
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h }
}

/**
 * Zeichnet den Floorplan (Hintergrundbild + Vektor-Elemente aus canvas_data)
 * direkt in ein pdfkit-Dokument, anstelle des früheren Raster-Snapshots.
 */
export function drawFloorplanVector(doc, { canvasData, towers, bars, channels, imagePath }, { x, y, width, height }) {
  const { elements } = parseCanvasData(canvasData)
  const scale = Math.min(width / STAGE_W, height / STAGE_H)
  const px = (v) => x + v * scale
  const py = (v) => y + v * scale

  const towerById = new Map((towers ?? []).map(t => [t.id, t]))
  const barById = new Map((bars ?? []).map(b => [b.id, b]))
  const channelById = new Map((channels ?? []).map(c => [c.id, c]))

  doc.save()
  doc.rect(x, y, width, height).clip()

  if (imagePath) {
    try {
      const buf = fs.readFileSync(imagePath)
      const { w: imgW, h: imgH } = readImageSize(buf)
      if (imgW > 0 && imgH > 0) {
        const r = containRect(imgW, imgH, STAGE_W, STAGE_H)
        doc.image(imagePath, px(r.x), py(r.y), { width: r.w * scale, height: r.h * scale })
      }
    } catch { /* Hintergrundbild ist optional, Fehler beim Lesen ignorieren */ }
  }

  for (const el of elements) {
    if (el.type === 'line') {
      doc.moveTo(px(el.x1), py(el.y1)).lineTo(px(el.x2), py(el.y2))
        .lineWidth((el.strokeWidth || 2) * scale).strokeColor(el.color || '#6b7280').stroke()
      continue
    }

    if (el.type === 'rect') {
      const cx = el.x + el.w / 2, cy = el.y + el.h / 2
      doc.save()
      if (el.rotation) doc.rotate(el.rotation, { origin: [px(cx), py(cy)] })
      doc.rect(px(el.x), py(el.y), el.w * scale, el.h * scale)
      if (el.fill && el.fill !== 'transparent') doc.fillColor(el.fill).fillOpacity(1).fill()
      doc.strokeColor(el.color || '#6b7280').lineWidth((el.strokeWidth || 2) * scale).stroke()
      doc.restore()
      continue
    }

    if (el.type === 'ellipse') {
      doc.save()
      if (el.rotation) doc.rotate(el.rotation, { origin: [px(el.x), py(el.y)] })
      doc.ellipse(px(el.x), py(el.y), el.rx * scale, el.ry * scale)
      if (el.fill && el.fill !== 'transparent') doc.fillColor(el.fill).fillOpacity(1).fill()
      doc.strokeColor(el.color || '#6b7280').lineWidth((el.strokeWidth || 2) * scale).stroke()
      doc.restore()
      continue
    }

    if (el.type === 'text') {
      doc.save()
      if (el.rotation) doc.rotate(el.rotation, { origin: [px(el.x), py(el.y)] })
      doc.font(el.fontStyle === 'bold' ? FONT_BOLD : FONT_NORMAL)
        .fontSize((el.fontSize || 16) * scale)
        .fillColor(el.color || '#9ca3af')
        .text(el.text || '', px(el.x), py(el.y), { lineBreak: false })
      doc.restore()
      continue
    }

    if (el.type === 'tower') {
      const tower = towerById.get(el.towerId)
      const w = el.w || 90, h = el.h || 54
      doc.roundedRect(px(el.x), py(el.y), w * scale, h * scale, 6 * scale)
        .fillColor(COLOR_CARD).fill()
        .strokeColor(COLOR_ACCENT).lineWidth(2 * scale).stroke()
      if (tower?.side) {
        const bx = px(el.x + w) - 22 * scale, by = py(el.y) + 5 * scale
        doc.roundedRect(bx, by, 17 * scale, 15 * scale, 3 * scale).fillColor(COLOR_ACCENT).fill()
        doc.font(FONT_BOLD).fontSize(10 * scale)
        doc.fillColor(COLOR_ACCENT_FOREGROUND)
          .text(tower.side, bx, by + (15 * scale - doc.currentLineHeight()) / 2, { width: 17 * scale, align: 'center', lineBreak: false })
      }
      const name = (tower?.name || el.towerName || 'Turm').slice(0, 11)
      doc.font(FONT_BOLD).fontSize(12 * scale)
      doc.fillColor(COLOR_FOREGROUND)
        .text(name, px(el.x), py(el.y + h / 2) - doc.currentLineHeight() / 2, { width: w * scale, align: 'center', lineBreak: false })
      continue
    }

    if (el.type === 'bar') {
      const bar = barById.get(el.barId)
      const w = el.w || 160, h = el.h || 28
      doc.roundedRect(px(el.x), py(el.y), w * scale, h * scale, 4 * scale)
        .fillColor('#10b981').fillOpacity(0.06).fill().fillOpacity(1)
      doc.dash(4 * scale, { space: 2 * scale })
        .roundedRect(px(el.x), py(el.y), w * scale, h * scale, 4 * scale)
        .strokeColor('#10b981').strokeOpacity(0.3).lineWidth(1 * scale).stroke().strokeOpacity(1)
      doc.undash()
      doc.moveTo(px(el.x), py(el.y + h / 2)).lineTo(px(el.x + w), py(el.y + h / 2))
        .lineCap('round').lineWidth(5 * scale).strokeColor('#10b981').stroke()
      doc.font(FONT_BOLD).fontSize(18 * scale)
      doc.fillColor('#6ee7b7')
        .text(bar?.name || el.barName || 'Stange', px(el.x + 4), py(el.y - 6) - doc.currentLineHeight(), { lineBreak: false })
      for (const fx of (bar?.fixtures ?? [])) {
        const fxx = px(el.x + fixtureXOffset(fx.position, bar?.length_cm, w))
        const fxy = py(el.y + h / 2)
        const r = 18 * scale
        doc.circle(fxx, fxy, r).fillColor('#dc3740').fill()
          .strokeColor('#dc3740').strokeOpacity(0.4).lineWidth(3 * scale).stroke().strokeOpacity(1)
        const label = String(channelById.get(fx.channel_id)?.channel ?? '?')
        doc.font(FONT_BOLD).fontSize(13 * scale)
        doc.fillColor('white')
          .text(label, fxx - r, fxy - doc.currentLineHeight() / 2, { width: r * 2, align: 'center', lineBreak: false })
      }
      continue
    }

    if (el.type === 'channel') {
      const pillW = 62 * scale
      const cx = px(el.x), cy = py(el.y)
      if (!el.noArrow) {
        const ap = arrowPoints(62, el.rotation)
        doc.moveTo(cx + ap.x1 * scale, cy + ap.y1 * scale).lineTo(cx + ap.x2 * scale, cy + ap.y2 * scale)
          .lineWidth(3 * scale).strokeColor(COLOR_ACCENT).stroke()
      }
      doc.roundedRect(cx - pillW / 2, cy - 18 * scale, pillW, 36 * scale, 18 * scale)
        .fillColor(COLOR_ACCENT).fill().strokeColor(COLOR_ACCENT).lineWidth(2 * scale).stroke()
      doc.font(FONT_BOLD).fontSize(18 * scale)
      doc.fillColor('white')
        .text(String(el.channel ?? ''), cx - pillW / 2, cy - doc.currentLineHeight() / 2, { width: pillW, align: 'center', lineBreak: false })
      continue
    }
  }

  doc.restore()
}

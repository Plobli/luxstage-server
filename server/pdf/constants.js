// Spaltenbreiten (mm → pt: 1mm ≈ 2.835pt)
export const mm = (v) => v * 2.835
export const PAGE_MARGIN = mm(15)
export const COL = {
  channel:  mm(12),
  color:    mm(20),
  address:  mm(16),
  device:   mm(35),
  notes:    0, // Rest (gesamte verbleibende Breite), wird in generatePDF gesetzt
}
export const ROW_MIN_H = mm(6)
export const HEADER_H  = mm(7)
export const GROUP_H   = mm(6)
export const FONT_NORMAL = 'Helvetica'
export const FONT_BOLD   = 'Helvetica-Bold'
export const COLOR_SWATCH_R = mm(2)
export const MAX_ROW_H = mm(40) // Sicherheitsgrenze gegen pdfkit Stack Overflow
export const BAR_TYPE_LABELS = { zugstange: 'Zugstange', traverse: 'Traverse', punktzug: 'Punktzug' }

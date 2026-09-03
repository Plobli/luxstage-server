// Elementtyp-Registry für FloorplanEditor.vue — sammelt die reine Geometrie-/
// Verhaltenslogik je Elementtyp an einer Stelle statt über ~40 verstreute
// el.type-Verzweigungen (Bounds, Rotationszentrum, Resize, Notiz-Anker,
// Erzeugen-beim-Ziehen). Reine Funktionen ohne Vue-Bezug, dadurch unabhängig
// von einer gemounteten Komponente testbar.
//
// Bewusst NICHT hier: das SVG-Rendering selbst und das Eigenschaften-Panel
// (bleiben in FloorplanEditor.vue) sowie towerAlreadyPlaced/barAlreadyPlaced
// (domänenspezifische Eindeutigkeitsregeln, kein Geometrie-Fall).

export type FloorplanElementType = 'line' | 'rect' | 'ellipse' | 'text' | 'channel' | 'tower' | 'bar'

export interface Point { x: number; y: number }
export interface Bounds extends Point { w: number; h: number }

interface ElementTypeDef {
  label: string
  /** Nur line: x1/y1/x2/y2 statt x/y — steuert Drag-Bewegung und Resize-Handles. */
  hasEndpoints?: true
  resizeHandles: 'endpoints' | 'corner' | 'none'
  /** Für Auswahl-Highlight + Resize-Handle-Position. */
  getBounds?: (el: any) => Bounds
  /**
   * Für Rotationszentrum UND Lasso-Trefferpunkt — im Original zweimal identisch
   * dupliziert, hier eine Quelle für beides.
   */
  getCenter?: (el: any) => Point
  applyResize?: (el: any, resizeObj: any, pos: Point) => void
  snapAfterResize?: (el: any, snap: (n: number) => number) => void
  /** Anker für die Notiz-Verbindungslinie. Ohne Eintrag: Fallback {x: el.x, y: el.y+10}. */
  noteAnchor?: (el: any) => Point
  /**
   * Nur für per Drag-Rechteck erzeugbare Typen (line/rect/ellipse). start/end
   * sind die rohen (nicht gerasterten) Mausposition — snap() muss auf das
   * jeweilige Ergebnisfeld angewendet werden, nicht auf start/end selbst
   * (bei rect/ellipse macht das einen Unterschied: min/abs bzw. Mittelpunkt/
   * Radius werden aus den rohen Werten berechnet, erst danach gerastert).
   */
  createFromDrag?: (start: Point, end: Point, snap: (n: number) => number) => Record<string, any>
}

export const ELEMENT_TYPES: Record<FloorplanElementType, ElementTypeDef> = {
  line: {
    label: 'Linie',
    hasEndpoints: true,
    resizeHandles: 'endpoints',
    getCenter: (el) => ({ x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 }),
    applyResize: (el, resizeObj, pos) => {
      if (resizeObj.point === 1) { el.x1 = pos.x; el.y1 = pos.y }
      else { el.x2 = pos.x; el.y2 = pos.y }
    },
    snapAfterResize: (el, snap) => {
      el.x1 = snap(el.x1); el.y1 = snap(el.y1); el.x2 = snap(el.x2); el.y2 = snap(el.y2)
    },
    noteAnchor: (el) => ({ x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 }),
    createFromDrag: (start, end, snap) => ({
      type: 'line', x1: snap(start.x), y1: snap(start.y), x2: snap(end.x), y2: snap(end.y),
      rotation: 0, color: '#6b7280', strokeWidth: 5,
    }),
  },
  rect: {
    label: 'Rechteck',
    resizeHandles: 'corner',
    getBounds: (el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }),
    getCenter: (el) => ({ x: el.x + el.w / 2, y: el.y + el.h / 2 }),
    applyResize: (el, resizeObj, pos) => {
      el.w = Math.max(5, pos.x - resizeObj.initX)
      el.h = Math.max(5, pos.y - resizeObj.initY)
    },
    snapAfterResize: (el, snap) => { el.w = snap(el.w); el.h = snap(el.h) },
    noteAnchor: (el) => ({ x: el.x + el.w / 2, y: el.y + el.h }),
    createFromDrag: (start, end, snap) => ({
      type: 'rect',
      x: snap(Math.min(start.x, end.x)), y: snap(Math.min(start.y, end.y)),
      w: snap(Math.abs(end.x - start.x)), h: snap(Math.abs(end.y - start.y)),
      rotation: 0, color: 'transparent', strokeWidth: 0, fill: '#e5e5e8',
    }),
  },
  ellipse: {
    label: 'Ellipse',
    resizeHandles: 'corner',
    getBounds: (el) => ({ x: el.x - el.rx, y: el.y - el.ry, w: el.rx * 2, h: el.ry * 2 }),
    getCenter: (el) => ({ x: el.x, y: el.y }),
    applyResize: (el, resizeObj, pos) => {
      el.rx = Math.max(3, pos.x - resizeObj.initX)
      el.ry = Math.max(3, pos.y - resizeObj.initY)
    },
    snapAfterResize: (el, snap) => { el.rx = snap(el.rx); el.ry = snap(el.ry) },
    noteAnchor: (el) => ({ x: el.x, y: el.y + el.ry }),
    createFromDrag: (start, end, snap) => ({
      type: 'ellipse',
      x: snap((start.x + end.x) / 2), y: snap((start.y + end.y) / 2),
      rx: snap(Math.abs(end.x - start.x) / 2), ry: snap(Math.abs(end.y - start.y) / 2),
      rotation: 0, color: 'transparent', strokeWidth: 0, fill: '#e5e5e8',
    }),
  },
  text: {
    label: 'Text',
    resizeHandles: 'none',
    getBounds: (el) => ({ x: el.x - 5, y: el.y - 5, w: (el.fontSize || 16) * 5, h: (el.fontSize || 16) + 10 }),
    getCenter: (el) => ({ x: el.x, y: el.y }),
  },
  channel: {
    label: 'Kanal',
    resizeHandles: 'none',
    noteAnchor: (el) => ({ x: el.x, y: el.y + 18 }),
  },
  tower: {
    label: 'Beleuchtungsgestell',
    resizeHandles: 'none',
    getBounds: (el) => ({ x: el.x, y: el.y, w: el.w || 120, h: el.h || 70 }),
  },
  bar: {
    label: 'Zugstange',
    resizeHandles: 'none',
    getBounds: (el) => ({ x: el.x, y: el.y, w: el.w || 160, h: el.h || 28 }),
  },
}

export function getElementLabel(type: string): string {
  return ELEMENT_TYPES[type as FloorplanElementType]?.label ?? type
}

export function getElementBounds(el: any): Bounds {
  return ELEMENT_TYPES[el.type as FloorplanElementType]?.getBounds?.(el) ?? { x: 0, y: 0, w: 0, h: 0 }
}

export function getElementCenter(el: any): Point {
  return ELEMENT_TYPES[el.type as FloorplanElementType]?.getCenter?.(el) ?? { x: el.x, y: el.y }
}

export function getNoteAnchor(el: any): Point {
  return ELEMENT_TYPES[el.type as FloorplanElementType]?.noteAnchor?.(el) ?? { x: el.x, y: el.y + 10 }
}

export function elementHasEndpoints(type: string): boolean {
  return !!ELEMENT_TYPES[type as FloorplanElementType]?.hasEndpoints
}

import { describe, it, expect } from 'vitest'
import {
  getElementLabel, getElementBounds, getElementCenter, getNoteAnchor, elementHasEndpoints,
  ELEMENT_TYPES,
} from './floorplanElementTypes'

describe('getElementLabel', () => {
  it('liefert das deutsche Label je Typ', () => {
    expect(getElementLabel('line')).toBe('Linie')
    expect(getElementLabel('tower')).toBe('Beleuchtungsgestell')
  })
  it('gibt den Rohwert zurück, wenn kein Eintrag existiert', () => {
    expect(getElementLabel('unknown')).toBe('unknown')
  })
})

describe('getElementBounds', () => {
  it('rect: x/y/w/h direkt', () => {
    expect(getElementBounds({ type: 'rect', x: 10, y: 20, w: 30, h: 40 })).toEqual({ x: 10, y: 20, w: 30, h: 40 })
  })
  it('ellipse: aus Mittelpunkt + Radien', () => {
    expect(getElementBounds({ type: 'ellipse', x: 100, y: 50, rx: 20, ry: 10 })).toEqual({ x: 80, y: 40, w: 40, h: 20 })
  })
  it('text: Fallback-Schriftgröße 16', () => {
    expect(getElementBounds({ type: 'text', x: 0, y: 0 })).toEqual({ x: -5, y: -5, w: 80, h: 26 })
  })
  it('tower/bar: Fallback-Breite/Höhe ohne w/h', () => {
    expect(getElementBounds({ type: 'tower', x: 5, y: 5 })).toEqual({ x: 5, y: 5, w: 120, h: 70 })
    expect(getElementBounds({ type: 'bar', x: 5, y: 5 })).toEqual({ x: 5, y: 5, w: 160, h: 28 })
  })
  it('line/channel: kein Bounds-Eintrag, Fallback 0/0/0/0', () => {
    expect(getElementBounds({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 })).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(getElementBounds({ type: 'channel', x: 5, y: 5 })).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })
})

describe('getElementCenter', () => {
  it('line: Mittelpunkt der Endpunkte', () => {
    expect(getElementCenter({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 20 })).toEqual({ x: 5, y: 10 })
  })
  it('rect: geometrische Mitte', () => {
    expect(getElementCenter({ type: 'rect', x: 0, y: 0, w: 40, h: 20 })).toEqual({ x: 20, y: 10 })
  })
  it('ellipse/text: x/y ist bereits der Mittelpunkt', () => {
    expect(getElementCenter({ type: 'ellipse', x: 7, y: 9, rx: 3, ry: 3 })).toEqual({ x: 7, y: 9 })
    expect(getElementCenter({ type: 'text', x: 7, y: 9 })).toEqual({ x: 7, y: 9 })
  })
  it('tower/bar/channel: kein Eintrag, Fallback auf x/y (wie Lasso-Auswahl im Original)', () => {
    expect(getElementCenter({ type: 'tower', x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
    expect(getElementCenter({ type: 'bar', x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
    expect(getElementCenter({ type: 'channel', x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
  })
})

describe('applyResize / snapAfterResize', () => {
  it('line: setzt je nach Punkt Start- oder Endpunkt', () => {
    const el: any = { type: 'line', x1: 0, y1: 0, x2: 10, y2: 10 }
    ELEMENT_TYPES.line.applyResize!(el, { point: 1 }, { x: 5, y: 6 })
    expect(el).toMatchObject({ x1: 5, y1: 6, x2: 10, y2: 10 })
    ELEMENT_TYPES.line.applyResize!(el, { point: 2 }, { x: 50, y: 60 })
    expect(el).toMatchObject({ x1: 5, y1: 6, x2: 50, y2: 60 })
  })

  it('rect: Breite/Höhe relativ zum initialen Ankerpunkt, minimal 5', () => {
    const el: any = { type: 'rect', x: 10, y: 10, w: 0, h: 0 }
    ELEMENT_TYPES.rect.applyResize!(el, { initX: 10, initY: 10 }, { x: 40, y: 25 })
    expect(el.w).toBe(30)
    expect(el.h).toBe(15)
    ELEMENT_TYPES.rect.applyResize!(el, { initX: 10, initY: 10 }, { x: 12, y: 11 })
    expect(el.w).toBe(5) // Mindestgröße greift
    expect(el.h).toBe(5)
  })

  it('ellipse: Radien relativ zum initialen Ankerpunkt, minimal 3', () => {
    const el: any = { type: 'ellipse', x: 10, y: 10, rx: 0, ry: 0 }
    ELEMENT_TYPES.ellipse.applyResize!(el, { initX: 10, initY: 10 }, { x: 30, y: 16 })
    expect(el.rx).toBe(20)
    expect(el.ry).toBe(6)
  })

  it('snapAfterResize rundet die jeweils typische Teilmenge der Felder', () => {
    const round10 = (n: number) => Math.round(n / 10) * 10

    const line: any = { x1: 1, y1: 2, x2: 8, y2: 9 }
    ELEMENT_TYPES.line.snapAfterResize!(line, round10)
    expect(line).toEqual({ x1: 0, y1: 0, x2: 10, y2: 10 })

    const rect: any = { x: 3, y: 3, w: 14, h: 16 }
    ELEMENT_TYPES.rect.snapAfterResize!(rect, round10)
    expect(rect).toEqual({ x: 3, y: 3, w: 10, h: 20 }) // x/y bleiben unangetastet — nur w/h werden gerundet

    const ellipse: any = { x: 3, y: 3, rx: 14, ry: 16 }
    ELEMENT_TYPES.ellipse.snapAfterResize!(ellipse, round10)
    expect(ellipse).toEqual({ x: 3, y: 3, rx: 10, ry: 20 })
  })
})

describe('getNoteAnchor', () => {
  it('line: Mittelpunkt', () => {
    expect(getNoteAnchor({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 })).toEqual({ x: 5, y: 0 })
  })
  it('rect: horizontal mittig, unterer Rand', () => {
    expect(getNoteAnchor({ type: 'rect', x: 0, y: 0, w: 20, h: 10 })).toEqual({ x: 10, y: 10 })
  })
  it('ellipse: unterer Scheitelpunkt', () => {
    expect(getNoteAnchor({ type: 'ellipse', x: 5, y: 5, ry: 3 })).toEqual({ x: 5, y: 8 })
  })
  it('channel: 18px unterhalb des Ankers', () => {
    expect(getNoteAnchor({ type: 'channel', x: 5, y: 5 })).toEqual({ x: 5, y: 23 })
  })
  it('tower/bar: Fallback 10px unterhalb (kein eigener Eintrag)', () => {
    expect(getNoteAnchor({ type: 'tower', x: 5, y: 5 })).toEqual({ x: 5, y: 15 })
    expect(getNoteAnchor({ type: 'bar', x: 5, y: 5 })).toEqual({ x: 5, y: 15 })
  })
})

describe('createFromDrag', () => {
  const noSnap = (n: number) => n

  it('line: übernimmt Start-/Endpunkt unverändert', () => {
    const el = ELEMENT_TYPES.line.createFromDrag!({ x: 1, y: 2 }, { x: 3, y: 4 }, noSnap)
    expect(el).toMatchObject({ type: 'line', x1: 1, y1: 2, x2: 3, y2: 4, color: '#6b7280', strokeWidth: 5 })
  })
  it('rect: normalisiert auf oben-links + positive Breite/Höhe, unabhängig von der Ziehrichtung', () => {
    const el = ELEMENT_TYPES.rect.createFromDrag!({ x: 30, y: 40 }, { x: 10, y: 5 }, noSnap)
    expect(el).toMatchObject({ type: 'rect', x: 10, y: 5, w: 20, h: 35 })
  })
  it('ellipse: Mittelpunkt und Radien aus Start-/Endpunkt', () => {
    const el = ELEMENT_TYPES.ellipse.createFromDrag!({ x: 0, y: 0 }, { x: 20, y: 10 }, noSnap)
    expect(el).toMatchObject({ type: 'ellipse', x: 10, y: 5, rx: 10, ry: 5 })
  })

  it('snap() wirkt auf das berechnete Ergebnis, nicht auf start/end — bei rect/ellipse macht das einen Unterschied', () => {
    const round30 = (n: number) => Math.round(n / 30) * 30
    // Mittelpunkt der ROHEN Punkte (10, 25) ist 17.5 -> snap(17.5) = 30.
    // Würde man erst start/end runden (snap(10)=0, snap(25)=30) und DANACH den
    // Mittelpunkt bilden, käme 15 heraus — ein anderer Wert. Der Test belegt,
    // dass hier tatsächlich zuerst gerechnet und danach gerastert wird.
    const ellipse = ELEMENT_TYPES.ellipse.createFromDrag!({ x: 10, y: 0 }, { x: 25, y: 0 }, round30)
    expect(ellipse.x).toBe(30)
  })
})

describe('elementHasEndpoints', () => {
  it('nur line hat Endpunkte statt x/y', () => {
    expect(elementHasEndpoints('line')).toBe(true)
    expect(elementHasEndpoints('rect')).toBe(false)
    expect(elementHasEndpoints('channel')).toBe(false)
    expect(elementHasEndpoints('unknown')).toBe(false)
  })
})

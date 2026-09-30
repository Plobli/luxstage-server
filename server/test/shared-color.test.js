import assert from 'node:assert/strict'
import { test } from 'node:test'

const { contrastColor } = await import('../../shared/color.js')

test('contrastColor wählt Schwarz auf hellem Hintergrund', () => {
  assert.equal(contrastColor('#ffffff'), '#000000')
  assert.equal(contrastColor('#ffff00'), '#000000') // Gelb, hell
})

test('contrastColor wählt Weiß auf dunklem Hintergrund', () => {
  assert.equal(contrastColor('#000000'), '#ffffff')
  assert.equal(contrastColor('#000080'), '#ffffff') // Navy, dunkel
})

test('server/pdf/filter-colors.js re-exportiert dieselbe contrastColor', async () => {
  const { contrastColor: fromPdf } = await import('../pdf/filter-colors.js')
  assert.equal(fromPdf, contrastColor)
})

test('buildSequenceColorMap: nie dieselbe Farbe für verschiedene Werte', async () => {
  const { buildSequenceColorMap, sequenceOrderColor } = await import('../../shared/color.js')
  const vals = ['1', '2', '1+2', '1+2+Pause', 'Pause', 'Test', '1+leer', ...Array.from({ length: 60 }, (_, i) => `x${i}`), '11', '12']
  const map = buildSequenceColorMap(vals)
  assert.equal(new Set(map.values()).size, vals.length)
  assert.equal(sequenceOrderColor(' 1 ', map), map.get('1'))
  assert.equal(sequenceOrderColor('', map), null)
})

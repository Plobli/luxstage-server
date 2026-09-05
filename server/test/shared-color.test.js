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

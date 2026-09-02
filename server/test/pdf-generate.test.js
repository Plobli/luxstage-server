import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { PassThrough } from 'node:stream'
import { cleanupDataPath } from './helpers/test-env.js'

const { generatePDF, pdfFilename } = await import('../pdf.js')

/** Sammelt den gerenderten PDF-Stream als Buffer. */
async function render(data, opts) {
  const out = new PassThrough()
  const chunks = []
  out.on('data', c => chunks.push(c))
  const done = new Promise(resolve => out.on('end', resolve))
  await generatePDF(data, out, opts)
  await done
  return Buffer.concat(chunks)
}

const show = { name: 'Test-Show', datum: '2026-09-01', template: 'Großes Haus' }
const channels = [
  { channel: '1', address: '1/001', device: 'PAR64', position: 'Portal links', color: 'L201', notes: 'Gegenlicht' },
  { channel: '2', address: '1/005', device: 'Fresnel', position: 'Portal links', color: '', notes: '' },
]

test('generatePDF schreibt ein PDF in einen beliebigen Stream — ohne HTTP-Response', async () => {
  const pdf = await render({ show, channels })
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-', 'kein PDF-Header')
  assert.ok(pdf.length > 1000, `PDF verdächtig klein: ${pdf.length} Bytes`)
})

test('generatePDF kommt mit den Vorgabewerten für optionale Daten aus', async () => {
  // Vordruck-Pfad: nur show und channels, wie ihn routes/templates.js nutzt.
  const pdf = await render({ show, channels }, { blank: true })
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
})

test('generatePDF rendert ohne Kanäle', async () => {
  const pdf = await render({ show, channels: [] })
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
})

test('pdfFilename unterscheidet Einleuchtplan und Vordruck', () => {
  assert.equal(pdfFilename('Hamlet', false), 'einleuchtplan-Hamlet.pdf')
  assert.equal(pdfFilename('Hamlet', true), 'kreisliste-vordruck-Hamlet.pdf')
  assert.equal(pdfFilename('', false), 'einleuchtplan-show.pdf')
  assert.equal(pdfFilename(undefined, false), 'einleuchtplan-show.pdf')
})

after(cleanupDataPath)

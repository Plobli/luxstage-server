import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rendererFor, SECTION_RENDERERS, DEFAULT_RENDERER } from '../pdf/section-renderers.js'

test('rendererFor liefert den passenden Renderer je Typ', () => {
  assert.equal(rendererFor('kv-table'), SECTION_RENDERERS['kv-table'])
  assert.equal(rendererFor('fields'), SECTION_RENDERERS.fields)
})

test('rendererFor fällt für unbekannte und fehlende Typen auf den Default zurück', () => {
  assert.equal(rendererFor('setup'), DEFAULT_RENDERER)
  assert.equal(rendererFor('gibt-es-nicht'), DEFAULT_RENDERER)
  assert.equal(rendererFor(undefined), DEFAULT_RENDERER)
})

test('kv-table hat nur Inhalt, wenn mindestens eine Zeile einen Wert trägt', () => {
  const r = rendererFor('kv-table')
  assert.equal(r.hasContent({ rows: [{ value: '  ' }, { value: '' }] }, ''), false)
  assert.equal(r.hasContent({ rows: [{ value: 'Wert' }] }, ''), true)
  assert.equal(r.hasContent({}, ''), false)
})

test('fields liest die Werte aus dem Content und behandelt Regex-Sonderzeichen als Text', () => {
  const r = rendererFor('fields')
  assert.equal(r.hasContent({ fields: [{ key: 'Ort' }] }, 'Ort: Bühne A'), true)
  assert.equal(r.hasContent({ fields: [{ key: 'Ort' }] }, 'Ort:   '), false)
  assert.equal(r.hasContent({ fields: [{ key: 'Ort' }] }, 'Datum: heute'), false)
  // Punkt und Klammern dürfen nicht als Regex-Metazeichen wirken.
  assert.equal(r.hasContent({ fields: [{ key: 'Saal (groß)' }] }, 'Saal (groß): 12'), true)
  assert.equal(r.hasContent({ fields: [{ key: 'a.c' }] }, 'abc: 12'), false)
})

test('der Default-Renderer erkennt leeren Setup-Text als inhaltslos', () => {
  assert.equal(DEFAULT_RENDERER.hasContent({}, ''), false)
})

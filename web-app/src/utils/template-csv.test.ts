import { describe, test, expect } from 'vitest'
import { parseTemplateCsv, templateNameFromFile } from './template-csv'

describe('parseTemplateCsv', () => {
  test('liest Zeilen ab der Kopfzeile als Objekte', () => {
    const rows = parseTemplateCsv([
      'channel;device;position',
      '1;PAR64;Portal links',
      '2;Fresnel;Portal rechts',
    ].join('\n'))

    expect(rows).toEqual([
      { channel: '1', device: 'PAR64', position: 'Portal links' },
      { channel: '2', device: 'Fresnel', position: 'Portal rechts' },
    ])
  })

  test('überspringt Zeilen vor der Kopfzeile', () => {
    const rows = parseTemplateCsv([
      '# Export aus Fremdsystem',
      '',
      'channel;device',
      '1;PAR64',
    ].join('\n'))

    expect(rows).toEqual([{ channel: '1', device: 'PAR64' }])
  })

  test('trimmt Werte und Kopfzeilen', () => {
    const rows = parseTemplateCsv('channel ; device \n 1 ; PAR64 ')
    expect(rows).toEqual([{ channel: '1', device: 'PAR64' }])
  })

  test('füllt fehlende Spalten mit leeren Zeichenketten', () => {
    const rows = parseTemplateCsv('channel;device;notes\n1;PAR64')
    expect(rows).toEqual([{ channel: '1', device: 'PAR64', notes: '' }])
  })

  test('liefert eine leere Liste ohne Kopfzeile oder Inhalt', () => {
    expect(parseTemplateCsv('a;b\n1;2')).toEqual([])
    expect(parseTemplateCsv('')).toEqual([])
    expect(parseTemplateCsv(undefined as any)).toEqual([])
  })
})

describe('templateNameFromFile', () => {
  test('entfernt die .csv-Endung unabhängig von der Schreibweise', () => {
    expect(templateNameFromFile('Grosses Haus.csv')).toBe('Grosses Haus')
    expect(templateNameFromFile('Studio.CSV')).toBe('Studio')
  })

  test('lässt Namen ohne Endung unangetastet und trimmt', () => {
    expect(templateNameFromFile('  Werkstattbühne  ')).toBe('Werkstattbühne')
    expect(templateNameFromFile('')).toBe('')
  })
})

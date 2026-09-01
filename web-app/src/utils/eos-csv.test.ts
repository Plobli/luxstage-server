import { describe, test, expect } from 'vitest'
import { parseEosCsv } from './eos-csv'

const CSV = [
  'START_LEVELS',
  'TARGET_TYPE,CHANNEL,PARAMETER_TYPE_AS_TEXT,LEVEL',
  'Cue,1,Intens,100',
  'Cue,2,Intens,0',
  'Cue,3,Intens,55',
  'Cue,3,Pan,50',
  'START_FIXTURES',
  'FIXTURE_TYPE_NAME,PARAMETER_TYPE_TEXT_SHORT',
  'Fusion_MBL40_Adv,Pan',
  'Fusion_MBL40_Adv,Tilt',
  'PAR64,Intens',
  'START_CHANNELS',
  'CHANNEL,FIXTURE_TYPE,MANUFACTURER,ADDRESS',
  '1,PAR64,ETC,121',
  '3,Fusion_MBL40_Adv,Robe,3/278<282',
  '4,PAR64,ETC,513',
].join('\n')

describe('parseEosCsv', () => {
  test('liest aktive Kanäle mit Level > 0', () => {
    const r = parseEosCsv(CSV)
    expect(r.error).toBeNull()
    expect(r.activeChannels).toEqual(['1', '3'])
  })

  test('erkennt Moving Lights über Pan/Tilt-Fixtures', () => {
    const r = parseEosCsv(CSV)
    expect(r.movingLightChannels.has('3')).toBe(true)
    expect(r.movingLightChannels.has('1')).toBe(false)
  })

  test('normalisiert Adressen auf Universum/Startadresse', () => {
    const r = parseEosCsv(CSV)
    expect(r.channelAddresses.get('1')).toBe('1/121')
    expect(r.channelAddresses.get('3')).toBe('3/278')
    // 513 liegt im zweiten Universum
    expect(r.channelAddresses.get('4')).toBe('2/001')
  })

  test('setzt Gerätenamen aus Hersteller und Typ zusammen, Unterstriche als Leerzeichen', () => {
    const r = parseEosCsv(CSV)
    expect(r.channelDevices.get('1')).toBe('ETC PAR64')
    expect(r.channelDevices.get('3')).toBe('Robe Fusion MBL40 Adv')
  })

  test('meldet Fehler bei fremdem Format', () => {
    const r = parseEosCsv('irgendwas\nanderes')
    expect(r.error).toBe('eos.import.error.invalid')
    expect(r.activeChannels).toBeNull()
  })

  test('meldet Parse-Fehler bei fehlendem Header', () => {
    const r = parseEosCsv('START_LEVELS\nkein header hier')
    expect(r.error).toBe('eos.import.error.parse')
  })
})

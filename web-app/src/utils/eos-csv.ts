// Parser für ETC-Eos-CSV-Exporte. Reine Funktionen ohne Vue-Bezug, damit das
// Fremdformat mit seinen Sonderfällen (Moving-Light-Erkennung, Adressnormalisierung)
// unabhängig von einer gemounteten Komponente testbar bleibt.

export interface EosCsvResult {
  activeChannels: string[] | null
  movingLightChannels: Set<string>
  channelAddresses: Map<string, string>
  channelDevices: Map<string, string>
  error: string | null
}

function findBlock(lines: string[], marker: string): { headers: string[], rows: string[][] } | null {
  const startIdx = lines.findIndex(l => l.trim() === marker)
  if (startIdx === -1) return null
  const headers = (lines[startIdx + 1] ?? '').split(',')
  const rows: string[][] = []
  for (let i = startIdx + 2; i < lines.length; i++) {
    if (lines[i].startsWith('START_')) break
    if (!lines[i].trim()) continue
    rows.push(lines[i].split(','))
  }
  return { headers, rows }
}

// Moving Lights (Pan/Tilt) bekommen keine sinnvolle feste Position/Notiz –
// sie werden beim Eos-Import automatisch erkannt statt dauerhaft gelb zu bleiben.
function findMovingLightChannels(lines: string[]): Set<string> {
  const fixtures = findBlock(lines, 'START_FIXTURES')
  const channelsBlock = findBlock(lines, 'START_CHANNELS')
  if (!fixtures || !channelsBlock) return new Set()

  const colTypeName = fixtures.headers.indexOf('FIXTURE_TYPE_NAME')
  const colParam     = fixtures.headers.indexOf('PARAMETER_TYPE_TEXT_SHORT')
  if (colTypeName === -1 || colParam === -1) return new Set()

  const movingLightTypes = new Set<string>()
  for (const row of fixtures.rows) {
    if (row[colParam] === 'Pan' || row[colParam] === 'Tilt') {
      movingLightTypes.add(row[colTypeName])
    }
  }
  if (movingLightTypes.size === 0) return new Set()

  const colChannel = channelsBlock.headers.indexOf('CHANNEL')
  const colFixtureType = channelsBlock.headers.indexOf('FIXTURE_TYPE')
  if (colChannel === -1 || colFixtureType === -1) return new Set()

  const result = new Set<string>()
  for (const row of channelsBlock.rows) {
    if (movingLightTypes.has(row[colFixtureType])) {
      const ch = (row[colChannel] ?? '').trim()
      if (ch) result.add(ch)
    }
  }
  return result
}

// Eos-Rohadressen kommen in drei Formen: reine Zahl ("121", auch >512 als
// durchlaufende Adresse über Universumsgrenzen), Range ohne Universum
// ("332<341") und Range mit Universum ("3/278<282"). LuxStage stellt
// Adressen einheitlich als "Universum/Startadresse" dar (z.B. "1/121").
function normalizeEosAddress(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  const withUniverse = value.match(/^(\d+)\/(\d+)(?:<\d+)?$/)
  if (withUniverse) {
    const universe = withUniverse[1]
    const address = withUniverse[2].padStart(3, '0')
    return `${universe}/${address}`
  }

  const withoutUniverse = value.match(/^(\d+)(?:<\d+)?$/)
  if (withoutUniverse) {
    const absolute = parseInt(withoutUniverse[1], 10)
    const universe = Math.floor((absolute - 1) / 512) + 1
    const address = ((absolute - 1) % 512 + 1).toString().padStart(3, '0')
    return `${universe}/${address}`
  }

  return null
}

function findChannelAddresses(lines: string[]): Map<string, string> {
  const channelsBlock = findBlock(lines, 'START_CHANNELS')
  if (!channelsBlock) return new Map()

  const colChannel = channelsBlock.headers.indexOf('CHANNEL')
  const colAddress = channelsBlock.headers.indexOf('ADDRESS')
  if (colChannel === -1 || colAddress === -1) return new Map()

  const result = new Map<string, string>()
  for (const row of channelsBlock.rows) {
    const ch = (row[colChannel] ?? '').trim()
    const addr = normalizeEosAddress(row[colAddress] ?? '')
    if (ch && addr) result.set(ch, addr)
  }
  return result
}

// Eos-Fixture-Typnamen nutzen Unterstriche statt Leerzeichen
// (z.B. "Fusion_MBL40_Adv") — für die Kreisliste lesbar machen.
function formatEosDevice(manufacturer: string, fixtureType: string): string {
  const parts = [manufacturer, fixtureType].filter(Boolean).map(p => p.trim().replace(/_/g, ' '))
  return parts.join(' ').trim()
}

function findChannelDevices(lines: string[]): Map<string, string> {
  const channelsBlock = findBlock(lines, 'START_CHANNELS')
  if (!channelsBlock) return new Map()

  const colChannel = channelsBlock.headers.indexOf('CHANNEL')
  const colFixtureType = channelsBlock.headers.indexOf('FIXTURE_TYPE')
  const colManufacturer = channelsBlock.headers.indexOf('MANUFACTURER')
  if (colChannel === -1 || colFixtureType === -1) return new Map()

  const result = new Map<string, string>()
  for (const row of channelsBlock.rows) {
    const ch = (row[colChannel] ?? '').trim()
    const device = formatEosDevice(colManufacturer !== -1 ? (row[colManufacturer] ?? '') : '', row[colFixtureType] ?? '')
    if (ch && device) result.set(ch, device)
  }
  return result
}

function emptyResult(error: string): EosCsvResult {
  return { activeChannels: null, movingLightChannels: new Set(), channelAddresses: new Map(), channelDevices: new Map(), error }
}

export function parseEosCsv(text: string): EosCsvResult {
  const lines = text.split(/\r?\n/)
  if (lines[0].trim() !== 'START_LEVELS') return emptyResult('eos.import.error.invalid')

  const headerIdx = lines.findIndex(l => l.startsWith('TARGET_TYPE,'))
  if (headerIdx === -1) return emptyResult('eos.import.error.parse')

  const headers = lines[headerIdx].split(',')
  const colChannel   = headers.indexOf('CHANNEL')
  const colParamType = headers.indexOf('PARAMETER_TYPE_AS_TEXT')
  const colLevel     = headers.indexOf('LEVEL')
  if (colChannel === -1 || colParamType === -1 || colLevel === -1) return emptyResult('eos.import.error.parse')

  const active = new Set<string>()
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols[colParamType] === 'Intens' && parseFloat(cols[colLevel]) > 0) {
      const ch = (cols[colChannel] ?? '').trim()
      if (ch) active.add(ch)
    }
  }

  return {
    activeChannels: [...active],
    movingLightChannels: findMovingLightChannels(lines),
    channelAddresses: findChannelAddresses(lines),
    channelDevices: findChannelDevices(lines),
    error: null,
  }
}

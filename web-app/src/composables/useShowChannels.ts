import { ref, computed, watch, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchChannels, saveChannels, mergeChannels, parseChannelsCsv, type Channel } from '../api/channels'
import { updateMeta } from '../api/shows'
import { invalidate } from '../api/cache'
import { ApiError } from '../api/client'
import { useUndoRedo } from './useUndoRedo'
import { type SectionDef } from './useShowSections'
import type { Tower } from '../api/towers'

export interface EosMergePreview {
  open: boolean;
  newActive: { nr: string, label: string }[];
  nowGone: { nr: string, label: string }[];
  untouched: { nr: string, label: string }[];
  addressMismatch: { nr: string, label: string, oldAddress: string, newAddress: string }[];
  deviceMismatch: { nr: string, label: string, oldDevice: string, newDevice: string }[];
  previouslyExcluded: Set<string>;
}

export interface UndoRedoState {
  channels: Channel[];
  sectionContents: [string, string][];
  sectionDefs: SectionDef[];
  meta: any;
  setupMarkdown: string;
  towers: Tower[];
}

export function useShowChannels({ 
  showId, 
  meta, 
  setupMarkdown, 
  sectionContents, 
  sectionDefs, 
  persistSetupDebounced,
  persistSectionsDebounced,
  persistSections,
  persistSectionDefs,
  towers,
  saveTowersSnapshot,
  t,
  localeReady,
  confirm
}: {
  showId: string;
  meta: Ref<any>;
  setupMarkdown: Ref<string>;
  sectionContents: Ref<Map<string, string>>;
  sectionDefs: Ref<SectionDef[]>;
  persistSetupDebounced: any;
  persistSectionsDebounced: any;
  persistSections: () => Promise<void>;
  persistSectionDefs: () => Promise<void>;
  towers: Ref<Tower[]>;
  saveTowersSnapshot: (snapshot: Tower[]) => Promise<void>;
  t: (key: string, params?: any) => string;
  localeReady: () => Promise<void>;
  confirm: (opts: any) => Promise<boolean>;
}) {
  const channels = ref<Channel[]>([])
  const channelsSaving = ref(false)
  const search = ref('')
  // Serverstand, auf dem die aktuelle channels.value-Kopie basiert. Wird bei
  // jedem erfolgreichen Laden/Speichern aktualisiert; weicht der Server beim
  // nächsten Save davon ab, hat jemand anders inzwischen gespeichert.
  const channelsVersion = ref<string | null>(null)
  const channelsConflict = ref<{ serverVersion: string, serverChannels: Channel[] } | null>(null)
  const healthFilter = ref<'noDevice' | 'noPosition' | 'noAddress' | 'incomplete' | null>(null)
  // Eingefrorene Kanal-IDs beim Aktivieren des Filters — reagiert nicht auf Tipp-Änderungen
  const healthFilterSnapshot = ref<Set<string> | null>(null)
  
  const eosActiveChannels = ref<string[] | null>(null)
  const eosExcludedChannels = ref<string[]>([])
  const eosMergePreview = ref<EosMergePreview>({ open: false, newActive: [], nowGone: [], untouched: [], addressMismatch: [], deviceMismatch: [], previouslyExcluded: new Set() })
  let _eosMergeResolve: ((v: { ok: boolean, applyAddresses: Set<string>, applyDevices: Set<string>, excludedChannels: Set<string> }) => void) | null = null
  let ignoreSseCount = 0

  const persistChannels = useDebounceFn(async () => {
    ignoreSseCount++
    try {
      const { version } = await saveChannels(showId, channels.value, channelsVersion.value)
      channelsVersion.value = version
      if (meta.value) {
        meta.value.datum = new Date().toISOString().split('T')[0]
        await updateMeta(showId, { ...meta.value })
      }
      invalidate('shows')
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        ignoreSseCount = Math.max(0, ignoreSseCount - 1) // kein SSE-Update zu erwarten, das übersprungen werden müsste
        channelsConflict.value = { serverVersion: e.body.serverVersion, serverChannels: e.body.serverChannels }
        return
      }
      throw e
    } finally {
      channelsSaving.value = false
    }
  }, 50)

  /** Konfliktauflösung: eigene Änderung verwerfen, Serverstand übernehmen. */
  function resolveConflictReload(): void {
    if (!channelsConflict.value) return
    channels.value = channelsConflict.value.serverChannels
    channelsVersion.value = channelsConflict.value.serverVersion
    channelsConflict.value = null
  }

  /** Konfliktauflösung: eigene Änderung trotzdem erzwingen (überschreibt den
   *  fremden Zwischenstand — bewusste Entscheidung, kein stiller Verlust mehr). */
  async function resolveConflictForce(): Promise<void> {
    if (!channelsConflict.value) return
    const target = channelsConflict.value.serverVersion
    channelsConflict.value = null
    channelsVersion.value = target
    scheduleChannelsSave()
  }

  function scheduleChannelsSave(): void {
    channelsSaving.value = true
    persistChannels()
  }

  const { initSnapshot, recordFocus, commitFocus, pushSnapshot, undo, redo, canUndo, canRedo } =
    useUndoRedo<UndoRedoState>(
      () => ({
        channels: channels.value,
        sectionContents: [...sectionContents.value.entries()],
        sectionDefs: sectionDefs.value,
        meta: meta.value,
        setupMarkdown: setupMarkdown.value,
        towers: towers.value,
      }),
      (snap) => {
        channels.value = snap.channels
        sectionContents.value = new Map(snap.sectionContents)
        sectionDefs.value = snap.sectionDefs
        meta.value = snap.meta
        setupMarkdown.value = snap.setupMarkdown
        towers.value = snap.towers ?? []
        saveTowersSnapshot(snap.towers ?? []).catch(() => {})
      },
      () => {
        (persistChannels as any)?.cancel?.()
        persistSetupDebounced?.cancel?.()
        persistSectionsDebounced?.cancel?.()
      },
      () => {
        channelsSaving.value = true
        persistChannels()
        persistSetupDebounced()
        persistSections()
        persistSectionDefs()
      }
    )

  function onUndoRedoKeydown(e: KeyboardEvent): void {
    const focused = document.activeElement
    const isEditing = focused && (
      focused.tagName === 'INPUT' ||
      focused.tagName === 'TEXTAREA' ||
      (focused as HTMLElement).isContentEditable
    )
    if (isEditing) return

    const isMac = (navigator as any).userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent)
    const mod = isMac ? e.metaKey : e.ctrlKey

    if (mod && !e.shiftKey && e.key === 'z') {
      e.preventDefault()
      undo()
    } else if (
      (mod && e.shiftKey && e.key === 'z') ||
      (mod && e.shiftKey && e.key === 'Z') ||
      (!isMac && mod && e.key === 'y')
    ) {
      e.preventDefault()
      redo()
    }
  }

  const dupAddressChannelNrs = computed(() => {
    const seen = new Map<string, string>()
    const dups = new Set<string>()
    for (const ch of channels.value) {
      const addr = ch.address
      if (!addr) continue
      if (seen.has(addr)) {
        dups.add(seen.get(addr)!)
        dups.add(ch.channel)
      } else {
        seen.set(addr, ch.channel)
      }
    }
    return dups
  })

  const dupWarning = computed(() => dupAddressChannelNrs.value.size > 0)

  const dupChannelNrs = computed(() => {
    const seen = new Set<string>()
    const dups = new Set<string>()
    for (const ch of channels.value) {
      if (ch.channel && seen.has(ch.channel)) dups.add(ch.channel)
      seen.add(ch.channel)
    }
    return dups
  })

  const dupChannelWarning = computed(() => dupChannelNrs.value.size > 0)

  const healthFilterFns: Record<string, (ch: Channel) => boolean> = {
    noDevice:   ch => !(ch.device ?? '').trim(),
    noPosition: ch => !(ch.position ?? '').trim(),
    noAddress:  ch => !(ch.address ?? '').trim(),
    incomplete: ch => !(ch.device ?? '').trim() || !(ch.position ?? '').trim() || !(ch.address ?? '').trim(),
  }

  function activateHealthFilter(type: 'noDevice' | 'noPosition' | 'noAddress' | 'incomplete' | null): void {
    healthFilter.value = type
    if (type && healthFilterFns[type]) {
      healthFilterSnapshot.value = new Set(
        channels.value.filter(healthFilterFns[type]).map(ch => ch.channel)
      )
    } else {
      healthFilterSnapshot.value = null
    }
  }

  const dupFilter = ref<'address' | 'channel' | null>(null)
  const hideEosInactive = ref(false)

  watch([dupAddressChannelNrs, dupChannelNrs], ([addrDups, chDups]) => {
    if (dupFilter.value === 'address' && addrDups.size === 0) dupFilter.value = null
    if (dupFilter.value === 'channel' && chDups.size === 0) dupFilter.value = null
  })

  watch(channels, () => {
    const type = healthFilter.value
    if (type && healthFilterFns[type] && !channels.value.some(healthFilterFns[type])) {
      healthFilter.value = null
      healthFilterSnapshot.value = null
    }
  }, { deep: true })

  const groupedChannels = computed(() => {
    const q = search.value.toLowerCase()
    const snap = healthFilterSnapshot.value
    const dupSnap = dupFilter.value === 'address' ? dupAddressChannelNrs.value
      : dupFilter.value === 'channel' ? dupChannelNrs.value
      : null
    let chs = (q || snap || dupSnap)
      ? [...channels.value].sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
      : [...channels.value]
    if (q) {
      chs = chs.filter(ch =>
        ch.channel?.includes(q) ||
        ch.device?.toLowerCase().includes(q) ||
        ch.notes?.toLowerCase().includes(q) ||
        ch.position?.toLowerCase().includes(q)
      )
    }
    if (snap) {
      chs = chs.filter(ch => snap.has(ch.channel))
    }
    if (dupSnap) {
      chs = chs.filter(ch => dupSnap.has(ch.channel))
    }
    if (hideEosInactive.value && eosActiveChannels.value) {
      chs = chs.filter(ch => channelStatus(ch) !== 'default')
    }
    const map = new Map<string, Channel[]>()
    for (const ch of chs) {
      const pos = ch.position || ''
      if (!map.has(pos)) map.set(pos, [])
      map.get(pos)!.push(ch)
    }
    return [...map.entries()].map(([position, channels]) => ({ position, channels }))
  })

  async function deleteChannel(ch: Channel): Promise<void> {
    pushSnapshot()
    channels.value = channels.value.filter(c => c !== ch)
    scheduleChannelsSave()
  }

  function clearChannel(ch: Channel): void {
    pushSnapshot()
    ch.notes = ''
    ch.color = ''
    scheduleChannelsSave()
  }

  function onCsvImportSelected(event: any): void {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const imported = parseChannelsCsv(e.target?.result as string)
      if (imported.length === 0) return
      pushSnapshot()
      channels.value = mergeChannels(channels.value, imported)
      scheduleChannelsSave()
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function parseEosCsv(text: string): { activeChannels: string[] | null, movingLightChannels: Set<string>, channelAddresses: Map<string, string>, channelDevices: Map<string, string>, error: string | null } {
    const lines = text.split(/\r?\n/)
    if (lines[0].trim() !== 'START_LEVELS') {
      return { activeChannels: null, movingLightChannels: new Set(), channelAddresses: new Map(), channelDevices: new Map(), error: 'eos.import.error.invalid' }
    }
    const headerIdx = lines.findIndex(l => l.startsWith('TARGET_TYPE,'))
    if (headerIdx === -1) return { activeChannels: null, movingLightChannels: new Set(), channelAddresses: new Map(), channelDevices: new Map(), error: 'eos.import.error.parse' }
    const headers = lines[headerIdx].split(',')
    const colChannel   = headers.indexOf('CHANNEL')
    const colParamType = headers.indexOf('PARAMETER_TYPE_AS_TEXT')
    const colLevel     = headers.indexOf('LEVEL')
    if (colChannel === -1 || colParamType === -1 || colLevel === -1) {
      return { activeChannels: null, movingLightChannels: new Set(), channelAddresses: new Map(), channelDevices: new Map(), error: 'eos.import.error.parse' }
    }
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

  async function persistEosChannels(): Promise<void> {
    await updateMeta(showId, {
      ...meta.value,
      setupMarkdown: setupMarkdown.value,
      eosActiveChannels: eosActiveChannels.value,
      eosExcludedChannels: eosExcludedChannels.value,
    })
  }

  async function onEosFileSelected(e: any): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const text = await file.text()
    const { activeChannels, movingLightChannels, channelAddresses, channelDevices, error } = parseEosCsv(text)

    if (error || !activeChannels) {
      window.alert(t(error || 'eos.import.error.parse'))
      return
    }

    const channelsWithNotes = new Set(
      channels.value.filter(ch => (ch.notes ?? '').trim().length > 0).map(ch => String(ch.channel))
    )

    function chLabel(nr: string): string {
      const ch = channels.value.find(c => String(c.channel) === nr)
      if (!ch) return ''
      return [ch.device, ch.position].filter(Boolean).join(' / ')
    }

    const prev = eosActiveChannels.value ?? []
    const prevActiveNrs = new Set(prev.filter(ch => !ch.startsWith('-')))
    const prevTracked = prev.map(ch => ch.startsWith('-') ? ch.slice(1) : ch)
      .filter(nr => !channelsWithNotes.has(nr))

    // "Neu aktiv" heißt: war beim letzten Import noch nicht als aktiv
    // getrackt — nicht "hat aktuell keine Notiz". Sonst taucht bei jedem
    // erneuten Import derselben CSV wieder die komplette Liste als neu auf.
    const newActiveNrs  = activeChannels.filter(nr => !channelsWithNotes.has(nr) && !prevActiveNrs.has(nr))
    const nowGoneNrs    = prevTracked.filter(nr => !activeChannels.includes(nr))
    const untouchedNrs  = activeChannels.filter(nr => channelsWithNotes.has(nr) || prevActiveNrs.has(nr))

    // Kanäle mit vorhandener, aber abweichender Adresse werden nie automatisch
    // überschrieben — der Nutzer entscheidet selbst, nachdem er es hier sieht.
    const addressMismatches = channels.value
      .filter(ch => {
        const eosAddr = channelAddresses.get(String(ch.channel))
        const currentAddr = (ch.address ?? '').trim()
        return eosAddr && currentAddr && eosAddr !== currentAddr
      })
      .map(ch => ({ nr: String(ch.channel), label: chLabel(String(ch.channel)), oldAddress: ch.address ?? '', newAddress: channelAddresses.get(String(ch.channel))! }))
      .sort((a, b) => parseInt(a.nr, 10) - parseInt(b.nr, 10))

    // Gleiche Logik wie bei Adressen: vorhandenes, abweichendes device wird
    // nie automatisch überschrieben.
    const deviceMismatches = channels.value
      .filter(ch => {
        const eosDevice = channelDevices.get(String(ch.channel))
        const currentDevice = (ch.device ?? '').trim()
        return eosDevice && currentDevice && eosDevice !== currentDevice
      })
      .map(ch => ({ nr: String(ch.channel), label: chLabel(String(ch.channel)), oldDevice: ch.device ?? '', newDevice: channelDevices.get(String(ch.channel))! }))
      .sort((a, b) => parseInt(a.nr, 10) - parseInt(b.nr, 10))

    // Eos liefert Kanäle in Cue-Reihenfolge, nicht numerisch — für die
    // Vorschau sortieren, damit der Nutzer die Liste überblicken kann.
    const byChannelNr = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10)

    const previouslyExcluded = new Set(eosExcludedChannels.value)

    const { ok, applyAddresses, applyDevices, excludedChannels } = await new Promise<{ ok: boolean, applyAddresses: Set<string>, applyDevices: Set<string>, excludedChannels: Set<string> }>(resolve => {
      _eosMergeResolve = resolve
      eosMergePreview.value = {
        open: true,
        newActive:  [...newActiveNrs].sort(byChannelNr).map(nr => ({ nr, label: chLabel(nr) })),
        nowGone:    [...nowGoneNrs].sort(byChannelNr).map(nr => ({ nr, label: chLabel(nr) })),
        untouched:  [...untouchedNrs].sort(byChannelNr).map(nr => ({ nr, label: chLabel(nr) })),
        addressMismatch: addressMismatches,
        deviceMismatch: deviceMismatches,
        previouslyExcluded,
      }
    })
    eosMergePreview.value.open = false
    if (!ok) return

    // Vom Nutzer im Dialog abgewählte Kanäle werden so behandelt, als wären
    // sie nicht im Eos-Export aktiv — kein Anlegen, keine Notiz, kein Tracking.
    const newActiveNrsFiltered = newActiveNrs.filter(nr => !excludedChannels.has(nr))

    // t() liefert vor Abschluss des initialen Tolgee-Ladevorgangs den rohen
    // Key statt der Übersetzung — hier wird das Ergebnis dauerhaft in notes
    // gespeichert, also muss die Übersetzung sicher geladen sein.
    await localeReady()
    const movingLightNote = t('eos.import.moving_light_note')
    const existingNrs = new Set(channels.value.map(ch => String(ch.channel)))
    const missingNrs = newActiveNrsFiltered.filter(nr => !existingNrs.has(nr))
    let channelsChanged = false

    if (missingNrs.length > 0) {
      const newChannels: Channel[] = missingNrs.map(nr => ({
        channel: nr, address: channelAddresses.get(nr) ?? '', device: channelDevices.get(nr) ?? '', position: '', color: '',
        notes: movingLightChannels.has(nr) ? movingLightNote : '',
      }))
      channels.value = [...channels.value, ...newChannels]
        .sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
      channelsChanged = true
    }

    for (const ch of channels.value) {
      const nr = String(ch.channel)
      if (excludedChannels.has(nr)) continue
      if (newActiveNrsFiltered.includes(nr) && movingLightChannels.has(nr) && !(ch.notes ?? '').trim()) {
        ch.notes = movingLightNote
        channelsChanged = true
      }
      if (!(ch.address ?? '').trim() && channelAddresses.has(nr)) {
        ch.address = channelAddresses.get(nr)!
        channelsChanged = true
      } else if (applyAddresses.has(nr) && channelAddresses.has(nr)) {
        ch.address = channelAddresses.get(nr)!
        channelsChanged = true
      }
      if (!(ch.device ?? '').trim() && channelDevices.has(nr)) {
        ch.device = channelDevices.get(nr)!
        channelsChanged = true
      } else if (applyDevices.has(nr) && channelDevices.has(nr)) {
        ch.device = channelDevices.get(nr)!
        channelsChanged = true
      }
    }

    if (channelsChanged) {
      const { version } = await saveChannels(showId, channels.value, channelsVersion.value)
      channelsVersion.value = version
    }

    // eosActiveChannels muss weiterhin alle aktiven Kanäle enthalten (nicht
    // nur die im Dialog als "neu" markierten), sonst verliert channelStatus()
    // die gelbe Markierung für bereits zuvor getrackte Kanäle.
    const stillActiveNrs = activeChannels.filter(nr => !excludedChannels.has(nr))
    eosActiveChannels.value = [
      ...stillActiveNrs,
      ...nowGoneNrs.map(nr => `-${nr}`),
    ]
    // excludedChannels ist die vollständige, im Dialog bestätigte Ausschlussmenge
    // (inkl. zuvor schon dauerhaft ausgeschlossener Kanäle) — direkt übernehmen,
    // damit sie beim nächsten Import wieder als "wird nicht importiert" erscheinen.
    eosExcludedChannels.value = [...excludedChannels]
    await persistEosChannels()
  }

  function resolveEosMergePreview(value: boolean, applyAddresses?: Set<string>, excludedChannels?: Set<string>, applyDevices?: Set<string>): void {
    _eosMergeResolve?.({ ok: value, applyAddresses: applyAddresses ?? new Set(), applyDevices: applyDevices ?? new Set(), excludedChannels: excludedChannels ?? new Set() })
    _eosMergeResolve = null
  }

  function channelStatus(ch: Channel): 'active' | 'eos' | 'default' {
    const notes = (ch.notes ?? '').trim()
    if (notes.length > 0) return 'active'
    if (ch.mount_ref) return 'active'
    const nr = String(ch.channel)
    if (!eosActiveChannels.value) return 'default'
    if (eosActiveChannels.value.includes(nr)) return 'eos'
    if (eosActiveChannels.value.includes(`-${nr}`)) return 'default'
    return 'default'
  }

  async function toggleChannelStatus(ch: Channel): Promise<void> {
    if (!eosActiveChannels.value) return
    const nr = String(ch.channel)
    const status = channelStatus(ch)
    if (status === 'active') return

    if (status === 'eos') {
      eosActiveChannels.value = eosActiveChannels.value.map(c => c === nr ? `-${nr}` : c)
    } else {
      const hasInactive = eosActiveChannels.value.includes(`-${nr}`)
      if (hasInactive) {
        eosActiveChannels.value = eosActiveChannels.value.map(c => c === `-${nr}` ? nr : c)
      }
    }
    await persistEosChannels()
  }

  async function loadChannels(): Promise<void> {
    const { channels: chs, version } = await fetchChannels(showId)
    channels.value = Array.isArray(chs) ? chs : []
    channelsVersion.value = version
  }

  async function handleChannelsSse(): Promise<void> {
    if (ignoreSseCount > 0) { ignoreSseCount--; return }
    const { channels: chs, version } = await fetchChannels(showId)
    channels.value = Array.isArray(chs) ? chs : []
    channelsVersion.value = version
  }

  return {
    channels,
    channelsSaving,
    search,
    healthFilter,
    activateHealthFilter,
    eosActiveChannels,
    eosExcludedChannels,
    eosMergePreview,
    dupWarning,
    dupAddressChannelNrs,
    dupChannelWarning,
    dupFilter,
    dupChannelNrs,
    hideEosInactive,
    groupedChannels,
    scheduleChannelsSave,
    persistChannels,
    deleteChannel,
    clearChannel,
    onCsvImportSelected,
    onEosFileSelected,
    resolveEosMergePreview,
    channelStatus,
    toggleChannelStatus,
    initSnapshot,
    recordFocus,
    commitFocus,
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    onUndoRedoKeydown,
    loadChannels,
    handleChannelsSse,
    channelsConflict,
    resolveConflictReload,
    resolveConflictForce
  }
}


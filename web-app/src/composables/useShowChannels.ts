import { ref, computed, watch, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchChannels, saveChannels, mergeChannels, parseChannelsCsv, scanCircuitSheet, type Channel } from '../api/channels'
import { updateMeta } from '../api/shows'
import { ApiError } from '../api/client'
import { useUndoRedo } from './useUndoRedo'
import { parseEosCsv } from '../utils/eos-csv'
import { buildCircuitScanDiff, type CircuitScanFieldChange, type CircuitScanUpdatedRow } from '../utils/circuitScanDiff'

export type { CircuitScanFieldChange, CircuitScanUpdatedRow }
export interface CircuitScanPreview {
  open: boolean;
  updated: CircuitScanUpdatedRow[];
  added: Channel[];
}

export interface EosMergePreview {
  open: boolean;
  newActive: { nr: string, label: string }[];
  nowGone: { nr: string, label: string }[];
  untouched: { nr: string, label: string }[];
  addressMismatch: { nr: string, label: string, oldAddress: string, newAddress: string }[];
  deviceMismatch: { nr: string, label: string, oldDevice: string, newDevice: string }[];
  previouslyExcluded: Set<string>;
}

export function useShowChannels({
  showId,
  meta,
  setupMarkdown,
  t,
  localeReady,
  onLockConflict,
  onAfterUndoRedo
}: {
  showId: string;
  meta: Ref<any>;
  setupMarkdown: Ref<string>;
  t: (key: string, params?: any) => string;
  localeReady: () => Promise<void>;
  onLockConflict?: (body: { lockedBy?: string, since?: number }) => void;
  /** Wird nach einem erfolgreichen Undo/Redo aufgerufen — muss alle vom Server
   *  geänderten Show-Daten (Kanäle, Sections, Türme, Bars) neu laden, da der
   *  Server sie nur ändert, ohne den neuen Stand direkt zurückzusenden. */
  onAfterUndoRedo?: () => void | Promise<void>;
}) {
  const channels = ref<Channel[]>([])
  const channelsSaving = ref(false)
  const channelsSaveError = ref<string | null>(null)
  const circuitScanUploading = ref(false)
  const circuitScanStatus = ref<{ type: 'success' | 'error', message: string } | null>(null)
  let circuitScanStatusTimer: ReturnType<typeof setTimeout> | null = null
  const circuitScanPreview = ref<CircuitScanPreview>({ open: false, updated: [], added: [] })
  let _circuitScanResolve: ((v: { ok: boolean, excludedChannels: Set<string> }) => void) | null = null

  function resolveCircuitScanPreview(ok: boolean, excludedChannels?: Set<string>): void {
    circuitScanPreview.value.open = false
    _circuitScanResolve?.({ ok, excludedChannels: excludedChannels ?? new Set() })
    _circuitScanResolve = null
  }

  function setCircuitScanStatus(type: 'success' | 'error', message: string, ttlMs: number): void {
    if (circuitScanStatusTimer) clearTimeout(circuitScanStatusTimer)
    circuitScanStatus.value = { type, message }
    circuitScanStatusTimer = setTimeout(() => { circuitScanStatus.value = null }, ttlMs)
  }
  const search = ref('')
  const healthFilter = ref<'noDevice' | 'noPosition' | 'noAddress' | 'incomplete' | null>(null)
  // Eingefrorene Kanal-IDs beim Aktivieren des Filters — reagiert nicht auf Tipp-Änderungen
  const healthFilterSnapshot = ref<Set<string> | null>(null)
  
  const eosActiveChannels = ref<string[] | null>(null)
  const eosExcludedChannels = ref<string[]>([])
  const eosMergePreview = ref<EosMergePreview>({ open: false, newActive: [], nowGone: [], untouched: [], addressMismatch: [], deviceMismatch: [], previouslyExcluded: new Set() })
  let _eosMergeResolve: ((v: { ok: boolean, applyAddresses: Set<string>, applyDevices: Set<string>, excludedChannels: Set<string> }) => void) | null = null

  // 800ms Pause seit letzter Änderung bevor gespeichert wird — verhindert, dass
  // jeder einzelne Tastendruck in einem Freitextfeld (z.B. ch.notes) einen
  // eigenen Undo-Eintrag erzeugt und den Undo-Stack (max. 50 Einträge) nach
  // einem einzigen getippten Satz aufbraucht. maxWait sorgt dafür, dass bei
  // ununterbrochenem Tippen trotzdem spätestens alle 4s gespeichert wird
  // (Schutz gegen Datenverlust bei Absturz/Tab-Schließen während langer Eingabe).
  const SAVE_DEBOUNCE_MS = 800
  const SAVE_MAX_WAIT_MS = 4000

  async function doPersistChannels(): Promise<void> {
    try {
      await saveChannels(showId, channels.value)
      markSaved()
      channelsSaveError.value = null
      if (meta.value) {
        meta.value.datum = new Date().toISOString().split('T')[0]
        await updateMeta(showId, { ...meta.value })
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        onLockConflict?.(e.body)
        return
      }
      // scheduleChannelsSave() ruft die debounced Version fire-and-forget auf (kein await,
      // kein .catch()) — ein erneutes throw hier würde eine unhandled promise rejection
      // erzeugen und der Nutzer würde nie erfahren, dass seine Änderung nicht gespeichert wurde.
      channelsSaveError.value = e instanceof ApiError ? e.message : t('error.save_failed')
      console.error('[useShowChannels] Autosave fehlgeschlagen:', e)
    } finally {
      channelsSaving.value = false
    }
  }

  const persistChannels = useDebounceFn(doPersistChannels, SAVE_DEBOUNCE_MS, { maxWait: SAVE_MAX_WAIT_MS })

  function scheduleChannelsSave(): void {
    channelsSaving.value = true
    persistChannels()
  }

  // Erzwingt ein sofortiges Speichern, ohne auf die Debounce-Pause zu warten —
  // an @blur eines Notiz-/Textfelds hängen, damit ein Verlassen des Felds nie
  // auf die nächste Pause wartet und die Änderung bei einem Wechsel zu einem
  // anderen Bereich sicher übernommen ist.
  async function flushChannelsSave(): Promise<void> {
    if (!channelsSaving.value) return
    await doPersistChannels()
  }

  // Der Server ändert die Daten bei Undo/Redo nur — er sendet den neuen Stand
  // nicht automatisch zurück. Ohne den Reload (onAfter) bliebe die Ansicht auf
  // dem alten Stand stehen, bis zufällig woanders neu geladen wird (führte dazu,
  // dass wiederholtes Klicken unbemerkt beliebig weit zurückspulte).
  const { undo, redo, canUndo, canRedo, markSaved, onUndoRedoKeydown } =
    useUndoRedo(showId, onLockConflict, onAfterUndoRedo, (e) => {
      // Undo/Redo selbst war erfolgreich — nur das Nachladen ist gescheitert.
      // Eigene Meldung statt error.save_failed, das wäre hier irreführend.
      channelsSaveError.value = t('error.reload_failed')
      console.error('[useShowChannels] Nachladen nach Undo/Redo fehlgeschlagen:', e)
    })

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
    channels.value = channels.value.filter(c => c !== ch)
    scheduleChannelsSave()
  }

  function clearChannel(ch: Channel): void {
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
      channels.value = mergeChannels(channels.value, imported)
      scheduleChannelsSave()
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  async function onCircuitScanFileSelected(event: any): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    circuitScanUploading.value = true
    circuitScanStatus.value = null
    try {
      const result = await scanCircuitSheet(showId, file)
      const imported = result.rows
      if (imported.length === 0) {
        setCircuitScanStatus('success', t('import.modal.scan.status.empty'), 4000)
        return
      }
      const { updated, added } = buildCircuitScanDiff(channels.value, imported)
      if (updated.length === 0 && added.length === 0) {
        setCircuitScanStatus('success', t('import.modal.scan.status.empty'), 4000)
        return
      }

      circuitScanPreview.value = { open: true, updated, added }
      const { ok, excludedChannels } = await new Promise<{ ok: boolean, excludedChannels: Set<string> }>(resolve => { _circuitScanResolve = resolve })
      if (!ok) return

      const filteredImported = imported.filter(row => !excludedChannels.has(row.channel))
      if (filteredImported.length === 0) {
        setCircuitScanStatus('success', t('import.modal.scan.status.empty'), 4000)
        return
      }

      channels.value = mergeChannels(channels.value, filteredImported)
      scheduleChannelsSave()
      const appliedUpdated = updated.filter(row => !excludedChannels.has(row.channel)).length
      const appliedAdded = added.filter(row => !excludedChannels.has(row.channel)).length
      setCircuitScanStatus('success', t('import.modal.scan.status.success', {
        updated: appliedUpdated,
        added: appliedAdded,
      }), 5000)
    } catch (e: any) {
      setCircuitScanStatus('error', e?.message || t('import.modal.scan.error'), 8000)
    } finally {
      circuitScanUploading.value = false
    }
  }

  // Wie doPersistChannels() bewusst ohne erneutes throw: beide Aufrufer
  // (onEosFileSelected, toggleChannelStatus) rufen fire-and-forget aus einem
  // Vue-Event-Handler auf (kein await/.catch() am Aufrufort) — ein throw hier
  // würde eine unhandled promise rejection erzeugen, ohne dass der Nutzer
  // erfährt, dass sein EOS-Import/Toggle nicht gespeichert wurde.
  async function persistEosChannels(): Promise<void> {
    try {
      await updateMeta(showId, {
        ...meta.value,
        setupMarkdown: setupMarkdown.value,
        eosActiveChannels: eosActiveChannels.value,
        eosExcludedChannels: eosExcludedChannels.value,
      })
      channelsSaveError.value = null
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        onLockConflict?.(e.body)
        return
      }
      channelsSaveError.value = e instanceof ApiError ? e.message : t('error.save_failed')
      console.error('[useShowChannels] EOS-Speichern fehlgeschlagen:', e)
    }
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
      await saveChannels(showId, channels.value)
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
    const chs = await fetchChannels(showId)
    channels.value = Array.isArray(chs) ? chs : []
  }

  return {
    channels,
    channelsSaving,
    channelsSaveError,
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
    flushChannelsSave,
    persistChannels,
    deleteChannel,
    clearChannel,
    onCsvImportSelected,
    onCircuitScanFileSelected,
    circuitScanUploading,
    circuitScanStatus,
    circuitScanPreview,
    resolveCircuitScanPreview,
    onEosFileSelected,
    resolveEosMergePreview,
    channelStatus,
    toggleChannelStatus,
    undo,
    redo,
    canUndo,
    canRedo,
    onUndoRedoKeydown,
    loadChannels,
  }
}


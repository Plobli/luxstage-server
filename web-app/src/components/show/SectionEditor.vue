<template>
  <!-- Sections (inline editor) -->
  <div ref="sortableSectionsEl">
    <section
      v-for="sec in sortedSections"
      :key="sec.id"
      :data-section-id="sec.id"
      class="group/sec relative"
    >
      <div v-if="!singleSectionId" class="shrink-0 sticky top-0 z-10 flex min-h-10 items-center gap-3 border-b border-border/90 bg-muted px-4">
          <Input
            :value="sec.title"
            :placeholder="labels.titlePlaceholder"
            @input="sec.title = $event.target.value"
            @change="saveSectionDefsFn"
            class="h-7 min-w-40 flex-1 border-0 bg-transparent px-0 text-sm font-semibold text-accent shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
          <Button variant="ghost" size="icon" class="size-6 rounded-sm text-muted-foreground/50 transition-colors shrink-0" @click="deleteSectionDef(sortedSections.indexOf(sec))">
            <X class="size-4" />
          </Button>
      </div>

      <!-- kv-table: echte <table>, identisch zur Kanaltabelle -->
      <div v-if="sec.type === 'kv-table'">
        <!-- Header -->
        <div :class="['shrink-0 sticky z-10 border-b border-border/90 bg-muted shadow-[0_1px_0_rgba(255,255,255,0.04),0_4px_8px_rgba(0,0,0,0.10)]', singleSectionId ? 'top-0' : 'top-10']">
          <div class="grid min-h-8 grid-cols-[2rem_1fr_1fr_2.5rem] items-center px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/90">
            <div></div>
            <div>{{ labels.fieldLabel }}</div>
            <div>{{ labels.fieldValue }}</div>
            <div></div>
          </div>
        </div>

        <!-- Leer-Zustand kv-table -->
        <div
          v-if="singleSectionId && sortedRows(sec).length === 0"
          class="flex flex-col items-center justify-center gap-3 py-16 text-center px-8"
        >
          <Table2 class="size-8 text-muted-foreground/40" />
          <div>
            <p class="text-base font-medium text-foreground/70">{{ t('section.fields.empty') }}</p>
            <p class="text-sm text-muted-foreground mt-1">{{ t('section.fields.empty.desc') }}</p>
          </div>
        </div>

        <!-- Zeilen -->
        <table :ref="el => setKvTableRef(sec.id, el)" class="w-full table-fixed border-collapse bg-card">
          <colgroup>
            <col class="w-8" />
            <col />
            <col />
            <col class="w-10" />
          </colgroup>
          <tbody>
            <tr
              v-for="row in sortedRows(sec)"
              :key="row.id"
              :data-row-id="row.id"
              class="group/row border-t border-border/60 bg-card transition-colors"
            >
              <td class="w-8 py-0 pl-1 pr-0 align-middle">
                <div class="kv-drag-handle drag-handle no-print flex size-6 cursor-grab items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 transition-all active:cursor-grabbing group-hover/row:opacity-100 hover:bg-muted/40">
                  <GripVertical class="size-3.5" />
                </div>
              </td>
              <td class="py-0 px-0 align-middle border-l border-border/40 h-full">
                <Input
                  v-model="row.label"
                  :placeholder="labels.fieldLabel"
                  @blur="persistKvRows(sec)"
                  class="h-full min-h-10 w-full rounded-none border-0 bg-transparent px-3 py-0 text-sm font-medium text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                />
              </td>
              <td class="py-0 px-0 align-middle border-l border-border/40 h-full">
                <Input
                  v-model="row.value"
                  @blur="persistKvRows(sec)"
                  class="h-full min-h-10 w-full rounded-none border-0 bg-transparent px-3 py-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                />
              </td>
              <td class="w-10 pl-1 pr-1 align-middle text-center border-l border-border/40">
                <Button variant="ghost" size="icon" class="size-7 rounded-sm text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100" @click="deleteKvRow(sec, row.id)">
                  <X class="size-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>

        <table class="w-full table-fixed border-collapse">
          <colgroup>
            <col class="w-8" />
            <col />
            <col />
            <col class="w-10" />
          </colgroup>
          <tbody>
            <tr class="border-t border-border/60 bg-card">
              <td colspan="4" class="px-4 py-1.5">
                <Button variant="ghost" size="sm" class="h-7 rounded-sm px-2 text-[11px] text-muted-foreground" @click="addKvRow(sec)">{{ labels.fieldAdd }}</Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else>
        <!-- Leer-Zustand markdown -->
        <div
          v-if="singleSectionId && !(sectionContents.get(sec.id) ?? '').trim() && !isActiveEdit(sec.id)"
          class="flex flex-col items-center justify-center gap-3 py-16 text-center px-8 cursor-text"
          @click="activateEdit(sec.id)"
        >
          <FileText class="size-8 text-muted-foreground/40" />
          <div>
            <p class="text-base font-medium text-foreground/70">{{ t('section.markdown.empty') }}</p>
            <p class="text-sm text-muted-foreground mt-1">{{ t('section.markdown.empty.desc') }}</p>
          </div>
        </div>
        <MarkdownEditor
          v-show="!singleSectionId || (sectionContents.get(sec.id) ?? '').trim() || isActiveEdit(sec.id)"
          :modelValue="sectionContents.get(sec.id) ?? ''"
          @update:modelValue="onSectionChange(sec.id, $event)"
          @blur="deactivateEditIfEmpty(sec.id)"
          class="rounded-none border-0 border-t border-border/60"
        />
      </div>
    </section>
  </div>

  <!-- Fallback: single setup editor (when no sections defined, not in single-section mode) -->
  <section v-if="!singleSectionId && sortedSections.length === 0" class="border-b border-border/60">
    <div class="border-b border-border/90 bg-muted px-4 py-2.5">
      <slot name="setup-heading" />
    </div>
    <MarkdownEditor :modelValue="setupMarkdown" @update:modelValue="emit('update:setupMarkdown', $event)" class="rounded-none border-0 border-t border-border/60" />
  </section>

  <!-- Add section buttons (not in single-section mode) -->
  <div v-if="!singleSectionId" class="flex items-center gap-2 border-b border-border/60 px-4 py-2">
    <Button variant="ghost" size="sm" class="h-7 rounded-sm px-2 text-[11px] text-muted-foreground" @click="addMarkdownSection">{{ labels.addMarkdown }}</Button>
    <Button v-if="!hasKvTableType()" variant="ghost" size="sm" class="h-7 rounded-sm px-2 text-[11px] text-muted-foreground" @click="addKvTableSection">{{ labels.addFields }}</Button>
    <HelpIcon :text="labels.addHelp" side="right" />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { GripVertical, X, FileText, Table2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import HelpIcon from '@/components/ui/HelpIcon.vue'
import Sortable from 'sortablejs'
const MarkdownEditor = defineAsyncComponent(() => import('../MarkdownEditor.vue'))
import { useConfirm } from '../../composables/useConfirm.js'
import { useLocale } from '../../composables/useLocale.js'
import { uuid } from '../../utils/uuid.js'

const props = defineProps({
  showId: { type: String, required: true },
  sectionDefs: { type: Array, required: true },
  sectionContents: { type: Map, required: true },
  setupMarkdown: { type: String, default: '' },
  singleSectionId: { type: String, default: null },
  labels: { type: Object, required: true },
  // Speichert sectionDefs über das Show-Composable (useShowSections), damit
  // Versionstracking für die Konflikterkennung greift — direkte
  // saveShowSectionDefs()-Aufrufe hier würden das Composable-eigene
  // sectionDefsVersion umgehen und den nächsten Save fälschlich als
  // Konflikt erkennen lassen.
  saveSectionDefsFn: { type: Function, required: true },
})

const emit = defineEmits([
  'update:sectionDefs',
  'update:sectionContents',
  'update:setupMarkdown',
  'sectionChange',
])

const { confirm } = useConfirm()
const { t } = useLocale()

const sortableSectionsEl = ref(null)
const activeEditSectionsSet = new Set()
const activeEditTick = ref(0)
function activateEdit(id) { activeEditSectionsSet.add(id); activeEditTick.value++ }
function deactivateEditIfEmpty(id) { if (!(props.sectionContents.get(id) ?? '').trim()) { activeEditSectionsSet.delete(id); activeEditTick.value++ } }
function isActiveEdit(id) { activeEditTick.value; return activeEditSectionsSet.has(id) }

// ── Migration: fields → kv-table ──────────────────────────────────────────
// Konvertiert 'fields'-Sections zu 'kv-table'.
// Repariert außerdem 'kv-table'-Sections die leere rows haben aber noch
// Werte in sectionContents (als JSON) besitzen – Übergangsfall nach fehlgeschlagener
// erster Migration.
function migrateAndRepair(defs, contentsMap) {
  let changed = false
  const newDefs = defs.map(sec => {
    // Fall 1: alter fields-Typ → kv-table
    if (sec.type === 'fields') {
      changed = true
      const rawJson = contentsMap.get(sec.id) ?? '{}'
      let valueObj = {}
      try { valueObj = JSON.parse(rawJson) } catch {}
      const rows = (sec.fields ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((f, i) => ({
          id: f.id ?? uuid(),
          label: f.label ?? '',
          value: valueObj[f.key] ?? '',
          sort_order: i,
        }))
      return { id: sec.id, title: sec.title, type: 'kv-table', order: sec.order, rows }
    }

    // Fall 2: bereits kv-table, aber rows leer und in sectionContents noch
    // ein JSON-Objekt mit Werten → erster Migrations-Versuch schlug fehl
    if (sec.type === 'kv-table' && (sec.rows ?? []).length === 0) {
      const rawJson = contentsMap.get(sec.id) ?? ''
      if (!rawJson) return sec
      let valueObj = null
      try { valueObj = JSON.parse(rawJson) } catch {}
      // Nur reparieren wenn es ein nicht-leeres Objekt ist (kein Array, kein leeres {})
      if (!valueObj || typeof valueObj !== 'object' || Array.isArray(valueObj)) return sec
      const entries = Object.entries(valueObj)
      if (entries.length === 0) return sec
      changed = true
      const rows = entries.map(([key, value], i) => ({
        id: uuid(),
        label: key,   // key ist hier der Feldname (best-effort Fallback)
        value: String(value ?? ''),
        sort_order: i,
      }))
      return { ...sec, rows }
    }

    return sec
  })
  return { defs: newDefs, changed }
}

// Migration beim Laden, sobald beide Props befüllt sind.
watch(
  [() => props.sectionDefs, () => props.sectionContents],
  ([defs, contents]) => {
    const needsMigration = defs.some(s => s.type === 'fields')
    const needsRepair = defs.some(
      s => s.type === 'kv-table' && (s.rows ?? []).length === 0 && contents.get(s.id)
    )
    if (!needsMigration && !needsRepair) return

    // Warten bis sectionContents geladen – wenn es sections gibt die einen
    // content-Eintrag haben sollten, aber die Map noch leer ist.
    const contentSections = defs.filter(s => s.type === 'markdown' || s.type === 'fields')
    if (contentSections.length > 0 && contents.size === 0) return

    const { defs: migrated, changed } = migrateAndRepair(defs, contents)
    if (changed) {
      emit('update:sectionDefs', migrated)
      props.saveSectionDefsFn()
    }
  },
  { immediate: true }
)

// ── Helpers ────────────────────────────────────────────────────────────────
const sortedSections = computed(() => {
  const all = [...props.sectionDefs].sort((a, b) => a.order - b.order)
  if (props.singleSectionId) return all.filter(s => s.id === props.singleSectionId)
  return all
})

function sortedRows(sec) {
  return [...(sec.rows ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

// ── SortableJS for sections ────────────────────────────────────────────────
let sortableInstance = null

function initSectionsSortable() {
  sortableInstance?.destroy()
  sortableInstance = null
  if (!sortableSectionsEl.value) return
  sortableInstance = Sortable.create(sortableSectionsEl.value, {
    handle: '.section-drag-handle',
    animation: 150,
    onEnd() {
      const els = sortableSectionsEl.value.querySelectorAll('[data-section-id]')
      const newOrder = [...els].map(el => el.getAttribute('data-section-id'))
      const reordered = newOrder.map((id, i) => {
        const sec = props.sectionDefs.find(s => s.id === id)
        return { ...sec, order: i }
      })
      emit('update:sectionDefs', reordered)
      props.saveSectionDefsFn()
    }
  })
}

watch(() => props.sectionDefs.length, () => nextTick(initSectionsSortable), { immediate: true })
watch(sortableSectionsEl, (el) => { if (el) nextTick(initSectionsSortable) })

// ── SortableJS for kv-table rows ───────────────────────────────────────────
const kvSortableInstances = new Map()
const kvTableRefs = new Map()

function setKvTableRef(sectionId, element) {
  if (element) kvTableRefs.set(sectionId, element)
  else kvTableRefs.delete(sectionId)
}

watch(
  () => props.sectionDefs.map(s => s.type === 'kv-table' ? (s.rows?.length ?? 0) : 0).join(','),
  async () => {
    await nextTick()
    // Destroy alte Instanzen für nicht mehr existierende Sections
    for (const [id, inst] of kvSortableInstances) {
      if (!props.sectionDefs.find(s => s.id === id)) {
        inst.destroy()
        kvSortableInstances.delete(id)
      }
    }
    // Neue/geänderte Sections initialisieren
    for (const sec of props.sectionDefs.filter(s => s.type === 'kv-table')) {
      const tableEl = kvTableRefs.get(sec.id)
      const el = tableEl?.tBodies[0] ?? tableEl
      if (!el) continue
      kvSortableInstances.get(sec.id)?.destroy()
      const instance = Sortable.create(el, {
        handle: '.kv-drag-handle',
        draggable: 'tr',
        animation: 150,
        onEnd(evt) {
          const sectionId = sec.id
          const newDefs = props.sectionDefs.map(s => {
            if (s.id !== sectionId) return s
            const rows = [...(s.rows ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            const moved = rows.splice(evt.oldIndex, 1)[0]
            rows.splice(evt.newIndex, 0, moved)
            rows.forEach((r, i) => { r.sort_order = i })
            return { ...s, rows }
          })
          emit('update:sectionDefs', newDefs)
          props.saveSectionDefsFn()
        }
      })
      kvSortableInstances.set(sec.id, instance)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  sortableInstance?.destroy()
  for (const inst of kvSortableInstances.values()) inst.destroy()
})

// ── Section content changes (markdown) ────────────────────────────────────
function onSectionChange(id, value) {
  const newMap = new Map(props.sectionContents)
  newMap.set(id, value)
  emit('update:sectionContents', newMap)
  emit('sectionChange')
}

// ── kv-table row persistence ───────────────────────────────────────────────
// Rows werden direkt in sectionDefs gehalten (sec.rows).
// Persistenz läuft über saveSectionDefsFn (section_defs + section_fields wird
// nicht mehr verwendet – der Server speichert rows über section_contents als JSON-Array).
function persistKvRows(sec) {
  // rows sind schon in-place mutiert (v-model-ähnlich über @input).
  // Wir emittieren sectionDefs damit Parent-State aktuell bleibt,
  // und triggern sectionChange für den debounced save.
  const newDefs = props.sectionDefs.map(s => s.id === sec.id ? { ...s, rows: sec.rows } : s)
  emit('update:sectionDefs', newDefs)
  props.saveSectionDefsFn()
}

// ── Section def management ─────────────────────────────────────────────────
async function addMarkdownSection() {
  const id = uuid()
  const newDefs = [...props.sectionDefs, { id, title: '', type: 'markdown', order: props.sectionDefs.length }]
  emit('update:sectionDefs', newDefs)
  await props.saveSectionDefsFn()
}

async function addKvTableSection() {
  const id = uuid()
  const newDefs = [...props.sectionDefs, { id, title: '', type: 'kv-table', order: props.sectionDefs.length, rows: [] }]
  emit('update:sectionDefs', newDefs)
  await props.saveSectionDefsFn()
}

async function deleteSectionDef(idx) {
  const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  const targetId = sortedSections.value[idx]?.id
  if (!targetId) return
  const newDefs = props.sectionDefs
    .filter(s => s.id !== targetId)
    .map((s, i) => ({ ...s, order: i }))
  emit('update:sectionDefs', newDefs)
  await props.saveSectionDefsFn()
}

function addKvRow(sec) {
  const newRow = { id: uuid(), label: '', value: '', sort_order: (sec.rows?.length ?? 0) }
  const newDefs = props.sectionDefs.map(s => {
    if (s.id !== sec.id) return s
    return { ...s, rows: [...(s.rows ?? []), newRow] }
  })
  emit('update:sectionDefs', newDefs)
  props.saveSectionDefsFn()
}

async function deleteKvRow(sec, rowId) {
  const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  const newDefs = props.sectionDefs.map(s => {
    if (s.id !== sec.id) return s
    const rows = (s.rows ?? [])
      .filter(r => r.id !== rowId)
      .map((r, i) => ({ ...r, sort_order: i }))
    return { ...s, rows }
  })
  emit('update:sectionDefs', newDefs)
  props.saveSectionDefsFn()
}

function hasKvTableType() {
  return props.sectionDefs.some(s => s.type === 'kv-table')
}
</script>

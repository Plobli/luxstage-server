import { ref, type Ref } from 'vue'
import {
  fetchTemplateBars, createTemplateBar, updateTemplateBar, deleteTemplateBar, reorderTemplateBars,
  type TemplateBar,
} from '../api/templateBars'
import { api } from '../api/client'
import { useDragReorder } from './useDragReorder'

export interface BarFixture {
  id: string;
  bar_id: string;
  position: number;
  channel: string | null;
  device: string | null;
  color: string | null;
  notes: string;
}

export function useTemplateBars(templateName: Ref<string | null>) {
  const bars = ref<TemplateBar[]>([])
  const fixtures = ref<Record<string, BarFixture[]>>({})

  const { draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } = useDragReorder(
    bars,
    (ordered) => reorderTemplateBars(templateName.value!, ordered.map(b => b.id)).catch(() => {})
  )

  async function loadBars(): Promise<void> {
    bars.value = await fetchTemplateBars(templateName.value!)
    fixtures.value = {}
    await Promise.all(bars.value.map(loadFixtures))
  }

  async function loadFixtures(bar: TemplateBar): Promise<void> {
    fixtures.value[bar.id] = await api.get<BarFixture[]>(`/api/templates/${encodeURIComponent(templateName.value!)}/bars/${bar.id}/fixtures`)
  }

  // ── Dialog: Bar anlegen/bearbeiten ──────────────────────────────────────
  const dialogOpen = ref(false)
  const editing = ref<TemplateBar | null>(null)
  const form = ref({ name: '', zug_nr: '', length_cm: 1100 })

  function openNew(): void {
    editing.value = null
    form.value = { name: '', zug_nr: '', length_cm: 1100 }
    dialogOpen.value = true
  }

  function openEdit(bar: TemplateBar): void {
    editing.value = bar
    form.value = { name: bar.name, zug_nr: bar.zug_nr, length_cm: bar.length_cm }
    dialogOpen.value = true
  }

  async function save(): Promise<void> {
    if (!form.value.name) return
    if (editing.value) {
      await updateTemplateBar(templateName.value!, editing.value.id, form.value)
      Object.assign(editing.value, form.value)
    } else {
      const { id } = await createTemplateBar(templateName.value!, form.value)
      const bar = { id, template_id: '', sort_order: bars.value.length, ...form.value } as TemplateBar
      bars.value.push(bar)
      await loadFixtures(bar)
    }
    dialogOpen.value = false
  }

  async function remove(barId: string, idx: number): Promise<void> {
    await deleteTemplateBar(templateName.value!, barId)
    bars.value.splice(idx, 1)
    delete fixtures.value[barId]
  }

  // ── Dialog: Fixture anlegen/bearbeiten ──────────────────────────────────
  const fixtureDialogOpen = ref(false)
  const editingFixture = ref<BarFixture | null>(null)
  const editingFixtureBar = ref<TemplateBar | null>(null)
  const fixtureForm = ref({ position: 0, channel: '', device: '', color: '', notes: '' })

  function openNewFixture(bar: TemplateBar): void {
    editingFixture.value = null
    editingFixtureBar.value = bar
    fixtureForm.value = { position: 0, channel: '', device: '', color: '', notes: '' }
    fixtureDialogOpen.value = true
  }

  function openEditFixture(bar: TemplateBar, fx: BarFixture): void {
    editingFixture.value = fx
    editingFixtureBar.value = bar
    fixtureForm.value = { position: fx.position, channel: fx.channel ?? '', device: fx.device ?? '', color: fx.color ?? '', notes: fx.notes ?? '' }
    fixtureDialogOpen.value = true
  }

  async function saveFixture(): Promise<void> {
    const bar = editingFixtureBar.value
    if (!bar) return
    const data = {
      position: fixtureForm.value.position,
      channel: fixtureForm.value.channel || null,
      device: fixtureForm.value.device || null,
      color: fixtureForm.value.color || null,
      notes: fixtureForm.value.notes || '',
    }
    if (editingFixture.value) {
      await api.put(`/api/templates/${encodeURIComponent(templateName.value!)}/bars/${bar.id}/fixtures/${editingFixture.value.id}`, data)
      Object.assign(editingFixture.value, data)
    } else {
      const { id } = await api.post<{ id: string }>(`/api/templates/${encodeURIComponent(templateName.value!)}/bars/${bar.id}/fixtures`, data)
      if (!fixtures.value[bar.id]) fixtures.value[bar.id] = []
      fixtures.value[bar.id].push({ id, bar_id: bar.id, ...data })
      fixtures.value[bar.id].sort((a, b) => a.position - b.position)
    }
    fixtureDialogOpen.value = false
  }

  async function removeFixture(bar: TemplateBar, fixtureId: string): Promise<void> {
    await api.delete(`/api/templates/${encodeURIComponent(templateName.value!)}/bars/${bar.id}/fixtures/${fixtureId}`)
    if (fixtures.value[bar.id]) {
      fixtures.value[bar.id] = fixtures.value[bar.id].filter(fx => fx.id !== fixtureId)
    }
  }

  return {
    bars, fixtures, loadBars,
    draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd,
    dialogOpen, editing, form, openNew, openEdit, save, remove,
    fixtureDialogOpen, editingFixture, fixtureForm, openNewFixture, openEditFixture, saveFixture, removeFixture,
  }
}

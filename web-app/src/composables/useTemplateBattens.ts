import { ref, type Ref } from 'vue'
import {
  fetchTemplateBattens, createTemplateBatten, updateTemplateBatten, deleteTemplateBatten, reorderTemplateBattens,
  fetchTemplateBattenFixtures, createTemplateBattenFixture, updateTemplateBattenFixture, deleteTemplateBattenFixture,
  type TemplateBatten, type TemplateBattenFixture as BattenFixture,
} from '../api/templateBattens'
import { useDragReorder } from './useDragReorder'

export type { BattenFixture }

export function useTemplateBattens(templateName: Ref<string | null>) {
  const battens = ref<TemplateBatten[]>([])
  const fixtures = ref<Record<string, BattenFixture[]>>({})

  const { draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } = useDragReorder(
    battens,
    (ordered) => reorderTemplateBattens(templateName.value!, ordered.map(b => b.id)).catch(() => {})
  )

  async function loadBattens(): Promise<void> {
    battens.value = await fetchTemplateBattens(templateName.value!)
    fixtures.value = {}
    await Promise.all(battens.value.map(loadFixtures))
  }

  async function loadFixtures(batten: TemplateBatten): Promise<void> {
    fixtures.value[batten.id] = await fetchTemplateBattenFixtures(templateName.value!, batten.id)
  }

  // ── Dialog: Batten anlegen/bearbeiten ──────────────────────────────────────
  const dialogOpen = ref(false)
  const editing = ref<TemplateBatten | null>(null)
  const form = ref({ name: '', batten_nr: '', length_cm: 1100 })

  function openNew(): void {
    editing.value = null
    form.value = { name: '', batten_nr: '', length_cm: 1100 }
    dialogOpen.value = true
  }

  function openEdit(batten: TemplateBatten): void {
    editing.value = batten
    form.value = { name: batten.name, batten_nr: batten.batten_nr, length_cm: batten.length_cm }
    dialogOpen.value = true
  }

  async function save(): Promise<void> {
    if (!form.value.name) return
    if (editing.value) {
      await updateTemplateBatten(templateName.value!, editing.value.id, form.value)
      Object.assign(editing.value, form.value)
    } else {
      const { id } = await createTemplateBatten(templateName.value!, form.value)
      const batten = { id, template_id: '', sort_order: battens.value.length, ...form.value } as TemplateBatten
      battens.value.push(batten)
      await loadFixtures(batten)
    }
    dialogOpen.value = false
  }

  async function remove(battenId: string, idx: number): Promise<void> {
    await deleteTemplateBatten(templateName.value!, battenId)
    battens.value.splice(idx, 1)
    delete fixtures.value[battenId]
  }

  // ── Dialog: Fixture anlegen/bearbeiten ──────────────────────────────────
  const fixtureDialogOpen = ref(false)
  const editingFixture = ref<BattenFixture | null>(null)
  const editingFixtureBatten = ref<TemplateBatten | null>(null)
  const fixtureForm = ref({ position: 0, channel: '', device: '', color: '', notes: '' })

  function openNewFixture(batten: TemplateBatten): void {
    editingFixture.value = null
    editingFixtureBatten.value = batten
    fixtureForm.value = { position: 0, channel: '', device: '', color: '', notes: '' }
    fixtureDialogOpen.value = true
  }

  function openEditFixture(batten: TemplateBatten, fx: BattenFixture): void {
    editingFixture.value = fx
    editingFixtureBatten.value = batten
    fixtureForm.value = { position: fx.position, channel: fx.channel ?? '', device: fx.device ?? '', color: fx.color ?? '', notes: fx.notes ?? '' }
    fixtureDialogOpen.value = true
  }

  async function saveFixture(): Promise<void> {
    const batten = editingFixtureBatten.value
    if (!batten) return
    const data = {
      position: fixtureForm.value.position,
      channel: fixtureForm.value.channel || null,
      device: fixtureForm.value.device || null,
      color: fixtureForm.value.color || null,
      notes: fixtureForm.value.notes || '',
    }
    if (editingFixture.value) {
      await updateTemplateBattenFixture(templateName.value!, batten.id, editingFixture.value.id, data)
      Object.assign(editingFixture.value, data)
    } else {
      const { id } = await createTemplateBattenFixture(templateName.value!, batten.id, data)
      if (!fixtures.value[batten.id]) fixtures.value[batten.id] = []
      fixtures.value[batten.id].push({ id, batten_id: batten.id, ...data })
      fixtures.value[batten.id].sort((a, b) => a.position - b.position)
    }
    fixtureDialogOpen.value = false
  }

  async function removeFixture(batten: TemplateBatten, fixtureId: string): Promise<void> {
    await deleteTemplateBattenFixture(templateName.value!, batten.id, fixtureId)
    if (fixtures.value[batten.id]) {
      fixtures.value[batten.id] = fixtures.value[batten.id].filter(fx => fx.id !== fixtureId)
    }
  }

  return {
    battens, fixtures, loadBattens,
    draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd,
    dialogOpen, editing, form, openNew, openEdit, save, remove,
    fixtureDialogOpen, editingFixture, fixtureForm, openNewFixture, openEditFixture, saveFixture, removeFixture,
  }
}

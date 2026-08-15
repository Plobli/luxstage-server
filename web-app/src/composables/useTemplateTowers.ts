import { ref, type Ref } from 'vue'
import {
  fetchTemplateTowers, createTemplateTower, updateTemplateTower, deleteTemplateTower,
  reorderTemplateTowers, updateTemplateTowerSlot, type TemplateTower, type TemplateTowerSlot,
} from '../api/templateTowers'
import { useDragReorder } from './useDragReorder'

export function useTemplateTowers(templateName: Ref<string | null>) {
  const towers = ref<TemplateTower[]>([])
  const expandedTowerId = ref<string | null>(null)

  const { draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd } = useDragReorder(
    towers,
    (ordered) => reorderTemplateTowers(templateName.value!, ordered.map(t => t.id)).catch(() => {})
  )

  async function loadTowers(): Promise<void> {
    towers.value = await fetchTemplateTowers(templateName.value!)
    expandedTowerId.value = null
  }

  function sortedSlots(tower: TemplateTower): TemplateTowerSlot[] {
    return [...(tower.slots ?? [])].sort((a, b) => a.slot_index - b.slot_index)
  }

  function toggleSlots(towerId: string): void {
    expandedTowerId.value = expandedTowerId.value === towerId ? null : towerId
  }

  // ── Dialog: Tower anlegen/bearbeiten ────────────────────────────────────
  const dialogOpen = ref(false)
  const editing = ref<TemplateTower | null>(null)
  const form = ref({ name: '', side: '', stage_area: '', slot_count: 4 })

  function openNew(): void {
    editing.value = null
    form.value = { name: '', side: '', stage_area: '', slot_count: 4 }
    dialogOpen.value = true
  }

  function openEdit(tower: TemplateTower): void {
    editing.value = tower
    form.value = { name: tower.name, side: tower.side, stage_area: tower.stage_area, slot_count: tower.slot_count }
    dialogOpen.value = true
  }

  async function save(): Promise<void> {
    if (!form.value.name) return
    if (editing.value) {
      await updateTemplateTower(templateName.value!, editing.value.id, form.value)
      Object.assign(editing.value, form.value)
      const tower = editing.value
      const existing = tower.slots ?? []
      const newCount = form.value.slot_count
      if (newCount > existing.length) {
        for (let i = existing.length + 1; i <= newCount; i++) {
          tower.slots.push({ id: '', tower_id: tower.id, slot_index: i, channel: null, device: null, color: null })
        }
      } else if (newCount < existing.length) {
        tower.slots = tower.slots.filter(s => s.slot_index <= newCount)
      }
    } else {
      const { id } = await createTemplateTower(templateName.value!, form.value)
      const slots: TemplateTowerSlot[] = []
      for (let i = 1; i <= form.value.slot_count; i++) {
        slots.push({ id: '', tower_id: id, slot_index: i, channel: null, device: null, color: null })
      }
      towers.value.push({ id, template_id: '', sort_order: towers.value.length, slots, ...form.value } as TemplateTower)
    }
    dialogOpen.value = false
  }

  async function remove(towerId: string, idx: number): Promise<void> {
    await deleteTemplateTower(templateName.value!, towerId)
    towers.value.splice(idx, 1)
  }

  // ── Dialog: Slot bearbeiten ──────────────────────────────────────────────
  const slotDialogOpen = ref(false)
  const editingSlot = ref<TemplateTowerSlot | null>(null)
  const editingSlotTower = ref<TemplateTower | null>(null)
  const slotForm = ref({ channel: '', device: '', color: '' })

  function openEditSlot(tower: TemplateTower, slot: TemplateTowerSlot): void {
    editingSlotTower.value = tower
    editingSlot.value = slot
    slotForm.value = { channel: slot.channel ?? '', device: slot.device ?? '', color: slot.color ?? '' }
    slotDialogOpen.value = true
  }

  async function saveSlot(): Promise<void> {
    const tower = editingSlotTower.value
    const slot = editingSlot.value
    if (!tower || !slot) return
    const data = {
      channel: slotForm.value.channel || null,
      device: slotForm.value.device || null,
      color: slotForm.value.color || null,
    }
    await updateTemplateTowerSlot(templateName.value!, tower.id, slot.slot_index, data)
    Object.assign(slot, data)
    slotDialogOpen.value = false
  }

  async function clearSlot(tower: TemplateTower, slotIndex: number): Promise<void> {
    await updateTemplateTowerSlot(templateName.value!, tower.id, slotIndex, { channel: null, device: null, color: null })
    const slot = (tower.slots ?? []).find(s => s.slot_index === slotIndex)
    if (slot) { slot.channel = null; slot.device = null; slot.color = null }
  }

  return {
    towers, expandedTowerId, loadTowers, sortedSlots, toggleSlots,
    draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd,
    dialogOpen, editing, form, openNew, openEdit, save, remove,
    slotDialogOpen, editingSlot, slotForm, openEditSlot, saveSlot, clearSlot,
  }
}

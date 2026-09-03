import { ref } from 'vue'

// Kopieren/Einfügen/Duplizieren ausgewählter Elemente in FloorplanEditor.vue.
// Bewusst NICHT hier: der Positions-Snapshot beim Ziehen eines Elements (onNodeMouseDown/
// onContainerMouseMove) — der nutzte im Original denselben `clipboard`-Ref zweckentfremdet als
// Drag-Start-Zustand, was zwei unabhängige Konzepte unter einem Namen vermischte. Mit dieser
// Extraktion ist `clipboard` hier ausschließlich der Copy/Paste-Inhalt; der Drag-Snapshot bleibt
// als eigene lokale Variable in der Komponente.

export interface ClipboardElement {
  id: string
  [key: string]: any
}

export function useEditorClipboard(
  elements: { value: ClipboardElement[] },
  selectedIds: { value: Set<string> },
  uuid: () => string,
  emitChange: () => void,
) {
  const clipboard = ref<ClipboardElement[] | null>(null)

  function copySelected() {
    if (selectedIds.value.size === 0) return
    clipboard.value = elements.value.filter(e => selectedIds.value.has(e.id)).map(e => ({ ...e }))
  }

  function pasteClipboard() {
    if (!clipboard.value?.length) return
    const newIds = new Set<string>()
    clipboard.value.forEach(el => {
      const newEl: ClipboardElement = { ...el, id: uuid(), x: (el.x ?? el.x1 ?? 0) + 20, y: (el.y ?? el.y1 ?? 0) + 20 }
      if (el.x1 !== undefined) { newEl.x1 = el.x1 + 20; newEl.y1 = el.y1 + 20; newEl.x2 = el.x2 + 20; newEl.y2 = el.y2 + 20 }
      elements.value.push(newEl); newIds.add(newEl.id)
    })
    selectedIds.value = newIds; emitChange()
  }

  function duplicateSelected() {
    copySelected()
    pasteClipboard()
  }

  return { clipboard, copySelected, pasteClipboard, duplicateSelected }
}

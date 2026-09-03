import { ref, nextTick } from 'vue'

// Inline-Bearbeitung von Text-Elementen (Doppelklick auf ein Text-Element in
// FloorplanEditor.vue öffnet ein <textarea> an der berechneten Bildschirmposition).
// Bewusst NICHT hier: das Erkennen des Doppelklick-Ziels selbst (onContainerDblClick bleibt
// in FloorplanEditor.vue, da es Teil der zentralen activeTool-Fallunterscheidung ist) — dieser
// Composable übernimmt erst ab dem Öffnen des Editors für ein konkretes Text-Element.

export interface TextEditElement { id: string; text: string; x: number; y: number; rotation?: number; fontSize?: number }

export function useInlineTextEdit(onCommit: (id: string, text: string) => void) {
  const textEditNode = ref<TextEditElement | null>(null)
  const textEditValue = ref('')
  const textEditStyle = ref<Record<string, string>>({})
  const textareaRef = ref<HTMLTextAreaElement | null>(null)

  function beginTextEdit(el: TextEditElement, svgEl: SVGSVGElement, containerEl: HTMLElement) {
    textEditNode.value = el
    textEditValue.value = el.text
    const CTM = svgEl.getScreenCTM()
    if (!CTM) return
    const box = containerEl.getBoundingClientRect()
    textEditStyle.value = {
      top: (CTM.f + el.y * CTM.d - box.top) + 'px',
      left: (CTM.e + el.x * CTM.a - box.left) + 'px',
      minWidth: '80px', fontSize: (el.fontSize || 16) + 'px',
      transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: '0 0',
    }
    nextTick(() => textareaRef.value?.focus())
  }

  function commitTextEdit() {
    if (!textEditNode.value) return
    onCommit(textEditNode.value.id, textEditValue.value)
    textEditNode.value = null
  }
  function cancelTextEdit() { textEditNode.value = null }

  return { textEditNode, textEditValue, textEditStyle, textareaRef, beginTextEdit, commitTextEdit, cancelTextEdit }
}

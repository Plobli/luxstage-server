<template>
  <div class="overflow-hidden bg-background/40" :class="$attrs.class ?? 'rounded-2xl border border-border/50'">
    <!-- Toolbar -->
    <div v-if="editor" class="flex flex-wrap items-center gap-1 border-b border-border/50 bg-muted/20 px-3 py-1.5 backdrop-blur-sm">
      <Toggle
        size="sm"
        :pressed="editor.isActive('bold')"
        @mousedown.prevent="editor.chain().focus().toggleBold().run()"
        class="h-11 md:h-8 rounded-full px-3 font-bold data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.bold')"
      >B</Toggle>
      <Toggle
        size="sm"
        :pressed="editor.isActive('italic')"
        @mousedown.prevent="editor.chain().focus().toggleItalic().run()"
        class="h-11 md:h-8 rounded-full px-3 italic data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.italic')"
      >I</Toggle>
      <Separator orientation="vertical" class="mx-1 h-4" />
      <Toggle
        size="sm"
        :pressed="editor.isActive('heading', { level: 3 })"
        @mousedown.prevent="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        class="h-11 md:h-8 rounded-full px-3 font-semibold data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.heading')"
      >H</Toggle>
      <Separator orientation="vertical" class="mx-1 h-4" />
      <Toggle
        size="sm"
        :pressed="editor.isActive('bulletList')"
        @mousedown.prevent="editor.chain().focus().toggleBulletList().run()"
        class="h-11 md:h-8 rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.list.bullet')"
      >≡</Toggle>
      <Toggle
        size="sm"
        :pressed="editor.isActive('orderedList')"
        @mousedown.prevent="editor.chain().focus().toggleOrderedList().run()"
        class="h-11 md:h-8 rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.list.ordered')"
      >1.</Toggle>
      <Separator orientation="vertical" class="mx-1 h-4" />
      <Toggle
        size="sm"
        :pressed="editor.isActive('table')"
        @mousedown.prevent="editor.isActive('table') ? editor.chain().focus().deleteTable().run() : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
        class="h-11 md:h-8 rounded-full px-3 data-[state=on]:bg-background data-[state=on]:text-foreground"
        :title="t('editor.table')"
      >⊞</Toggle>
      <template v-if="editor.isActive('table')">
        <Separator orientation="vertical" class="mx-1 h-4" />
        <button
          type="button"
          @mousedown.prevent="editor.chain().focus().addRowAfter().run()"
          class="h-11 md:h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
          :title="t('editor.table.add_row_after')"
        >+↓</button>
        <button
          type="button"
          @mousedown.prevent="editor.chain().focus().addColumnAfter().run()"
          class="h-11 md:h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
          :title="t('editor.table.add_col_after')"
        >+→</button>
        <button
          type="button"
          @mousedown.prevent="editor.chain().focus().deleteRow().run()"
          class="h-11 md:h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-background hover:text-red-400"
          :title="t('editor.table.delete_row')"
        >−↓</button>
        <button
          type="button"
          @mousedown.prevent="editor.chain().focus().deleteColumn().run()"
          class="h-11 md:h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-background hover:text-red-400"
          :title="t('editor.table.delete_col')"
        >−→</button>
      </template>
    </div>

    <!-- Editor Content -->
    <EditorContent
      :editor="editor"
      class="tiptap-content min-h-[120px] bg-transparent px-4 py-4 text-sm text-foreground focus-within:outline-none [&_.tiptap]:min-h-[120px] [&_.tiptap]:outline-none [&_.tiptap]:text-foreground [&_.tiptap_p]:my-1.5 [&_.tiptap_h3]:mb-1 [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:text-accent [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_li]:my-1 [&_.tiptap_strong]:font-semibold [&_.tiptap_strong]:text-foreground [&_.tiptap_em]:italic [&_.tiptap_.tableWrapper]:overflow-x-auto [&_.tiptap_table]:border-collapse [&_.tiptap_table]:w-full [&_.tiptap_table]:my-2 [&_.tiptap_td]:border [&_.tiptap_td]:border-border/60 [&_.tiptap_td]:px-2 [&_.tiptap_td]:py-1 [&_.tiptap_td]:min-w-24 [&_.tiptap_th]:border [&_.tiptap_th]:border-border/60 [&_.tiptap_th]:px-2 [&_.tiptap_th]:py-1 [&_.tiptap_th]:min-w-24 [&_.tiptap_th]:font-semibold [&_.tiptap_th]:text-accent [&_.tiptap_th]:bg-muted/60 [&_.tiptap_ul[data-type=taskList]]:list-none [&_.tiptap_ul[data-type=taskList]]:pl-0 [&_.tiptap_ul[data-type=taskList]_li]:flex [&_.tiptap_ul[data-type=taskList]_li]:items-baseline [&_.tiptap_ul[data-type=taskList]_li]:gap-2 [&_.tiptap_ul[data-type=taskList]_li_label]:flex [&_.tiptap_ul[data-type=taskList]_li_label]:items-center [&_.tiptap_ul[data-type=taskList]_li_input[type=checkbox]]:mt-0 [&_.tiptap_ul[data-type=taskList]_li_input[type=checkbox]]:size-4 [&_.tiptap_ul[data-type=taskList]_li_input[type=checkbox]]:cursor-pointer [&_.tiptap_ul[data-type=taskList]_li_input[type=checkbox]]:accent-accent"
    />
  </div>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
import { watch, onBeforeUnmount } from 'vue'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { useLocale } from '../composables/useLocale.js'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

const { t } = useLocale()
const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

function parseContent(val) {
  if (!val) return EMPTY_DOC
  try { return JSON.parse(val) } catch { return EMPTY_DOC }
}

const editor = useEditor({
  extensions: [
    StarterKit,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: false }),
  ],
  content: parseContent(props.modelValue),
  editorProps: { attributes: { class: 'tiptap' } },
  onFocus() { emit('focus') },
  onBlur() { emit('blur') },
  onUpdate({ editor }) {
    emit('update:modelValue', JSON.stringify(editor.getJSON()))
  },
})

watch(() => props.modelValue, (val) => {
  if (!editor.value || editor.value.isFocused) return
  const current = JSON.stringify(editor.value.getJSON())
  if (val === current) return
  editor.value.commands.setContent(parseContent(val), { emitUpdate: false })
}, { flush: 'post' })

onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-100 flex items-center justify-center bg-background/70 backdrop-blur-md no-print" @click.self="open = false">
        <div class="w-full max-w-sm rounded-xl border border-border/40 bg-popover p-5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)]">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-foreground">{{ t('shortcuts.title') }}</h2>
            <button type="button" class="text-muted-foreground hover:text-foreground" @click="open = false">
              <X class="size-4" />
            </button>
          </div>
          <div class="flex flex-col gap-1">
            <div v-for="row in rows" :key="row.label" class="flex items-center justify-between py-1.5 text-xs">
              <span class="text-muted-foreground">{{ row.label }}</span>
              <span class="flex gap-1">
                <kbd v-for="k in row.keys" :key="k" class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{{ k }}</kbd>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { X } from 'lucide-vue-next'
import { useLocale } from '@/composables/useLocale.js'

const { t } = useLocale()
const open = ref(false)

const rows = computed(() => [
  { label: t('shortcuts.navigate'), keys: ['↑', '↓', 'Tab'] },
  { label: t('shortcuts.confirm'), keys: ['Enter'] },
  { label: t('shortcuts.undo'), keys: ['⌘', 'Z'] },
  { label: t('shortcuts.redo'), keys: ['⌘', '⇧', 'Z'] },
  { label: t('shortcuts.escape'), keys: ['Esc'] },
])

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

function onKeydown(e) {
  if (e.key === '?' && !isTypingTarget(document.activeElement)) {
    e.preventDefault()
    open.value = !open.value
  } else if (e.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

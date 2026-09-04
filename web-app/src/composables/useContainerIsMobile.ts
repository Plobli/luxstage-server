import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export function useContainerIsMobile(el: Ref<HTMLElement | null>, breakpoint = 768): Ref<boolean> {
  const isMobile = ref(true)

  let ro: ResizeObserver | null = null

  onMounted(() => {
    if (!el.value) return
    isMobile.value = el.value.offsetWidth < breakpoint
    ro = new ResizeObserver(([entry]) => {
      isMobile.value = entry.contentRect.width < breakpoint
    })
    ro.observe(el.value)
  })

  onUnmounted(() => {
    ro?.disconnect()
  })

  return isMobile
}

import { ref } from 'vue'

export interface Toast {
  id: number;
  variant: 'success' | 'error' | 'info';
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export interface ToastOptions {
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  durationMs?: number;
}

const toasts = ref<Toast[]>([])
let nextId = 1
const DEFAULT_DURATION = 5000

export function useToastStore() {
  return { toasts }
}

function push(variant: Toast['variant'], title: string, options: ToastOptions = {}): number {
  const id = nextId++
  toasts.value.push({
    id,
    variant,
    title,
    description: options.description,
    retryLabel: options.retryLabel,
    onRetry: options.onRetry,
  })
  // Toasts mit Retry-Aktion bleiben stehen, bis der Nutzer reagiert — Auto-Dismiss
  // würde die Handlungsmöglichkeit unbemerkt wieder entziehen.
  if (!options.onRetry) {
    setTimeout(() => dismiss(id), options.durationMs ?? DEFAULT_DURATION)
  }
  return id
}

export function dismiss(id: number): void {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) toasts.value.splice(idx, 1)
}

export function useToast() {
  return {
    success: (title: string, options?: ToastOptions) => push('success', title, options),
    error: (title: string, options?: ToastOptions) => push('error', title, options),
    info: (title: string, options?: ToastOptions) => push('info', title, options),
  }
}

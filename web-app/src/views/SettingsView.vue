<template>
  <div class="flex h-full">
    <!-- Horizontale Sub-Navigation (Mobile) -->
    <div class="lg:hidden w-full">
      <nav class="border-b border-border overflow-x-auto">
        <ul role="list" class="flex min-w-full gap-x-6 px-4 text-sm font-semibold text-muted-foreground">
          <li v-for="item in nav" :key="item.to" class="flex">
            <RouterLink
              :to="item.to"
              :class="isActive(item.to) ? 'text-accent border-b-2 border-accent' : 'hover:text-foreground border-b-2 border-transparent'"
              class="flex items-center min-h-11 py-2 transition-colors whitespace-nowrap"
            >
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>
      <RouterView />
    </div>

    <!-- Content (Desktop) -->
    <div class="hidden lg:block flex-1 min-w-0 overflow-y-auto">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useLocale } from '../composables/useLocale.js'
import { api } from '../api/client.js'

const { t } = useLocale()
const route = useRoute()

const saasMode = ref(null)
onMounted(async () => {
  try {
    const status = await api.get('/api/status')
    saasMode.value = !!status.saasEnabled
  } catch {
    saasMode.value = false
  }
})

const nav = computed(() => [
  { to: '/settings/account', label: t('settings.account') },
  { to: '/settings/display', label: t('settings.display') },
  { to: '/settings/users', label: t('settings.users') },
  // Backup/Server/SMTP/Update sind Self-Hosted-Einstellungen, siehe App.vue settingsNavItems.
  ...(saasMode.value === false ? [{ to: '/settings/backup', label: t('settings.backup') }] : []),
  ...(saasMode.value === false ? [{ to: '/settings/server', label: t('settings.server') }] : []),
  ...(saasMode.value === false ? [{ to: '/settings/smtp', label: t('settings.smtp') }] : []),
  ...(saasMode.value === false ? [{ to: '/settings/update', label: t('settings.update') }] : []),
])

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

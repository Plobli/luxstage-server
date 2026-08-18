<template>
  <TolgeeProvider>
    <template v-slot:fallback>
      <div class="h-dvh flex items-center justify-center bg-background text-muted-foreground">Loading...</div>
    </template>
  <TooltipProvider>
  <div class="h-full bg-background pt-[env(safe-area-inset-top)]">
    <!-- Login-Route: kein Sidebar-Layout -->
    <RouterView v-if="route.meta.public" />

    <!-- App-Layout mit Sidebar -->
    <div v-else class="h-full bg-background">
      <!-- Mobile Sidebar -->
      <Transition name="fade">
        <div v-if="sidebarOpen" class="relative z-50 md:hidden" @keydown.esc="sidebarOpen = false">
          <Transition name="fade">
            <div v-if="sidebarOpen" class="fixed inset-0 bg-background/80 backdrop-blur-sm" @click="sidebarOpen = false" />
          </Transition>

          <div class="fixed inset-0 flex">
            <Transition name="slide">
              <div v-if="sidebarOpen" class="relative flex w-full max-w-xs flex-1">
                <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
                  <Button variant="ghost" size="icon" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
                    <span class="sr-only">Sidebar schließen</span>
                    <X class="size-6 text-foreground" aria-hidden="true" />
                  </Button>
                </div>
                <div class="flex grow flex-col gap-y-5 overflow-y-auto bg-background px-6 pb-2 border-r border-border">
                  <RouterLink to="/" class="flex h-16 shrink-0 items-center transition-opacity hover:opacity-80">
                    <img src="/favicon.png" alt="LuxStage" class="h-8 w-8 rounded-lg" />
                    <span class="ml-3 text-lg font-bold text-foreground">LuxStage</span>
                  </RouterLink>
                  <nav class="flex flex-1 flex-col">
                    <ul role="list" class="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" class="-mx-2 space-y-1">
                          <li v-for="item in navigation" :key="item.name">
                            <RouterLink
                              :to="item.to"
                              class="group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold"
                              :class="isActiveRoute(item) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                            >
                              <span class="relative shrink-0">
                                <component :is="item.icon" class="size-6" aria-hidden="true" />
                                <span v-if="item.badge?.value" class="absolute -top-1 -right-1 size-2 rounded-full bg-accent" />
                              </span>
                              {{ item.name }}
                            </RouterLink>
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </nav>
                  <div class="-mx-6 pb-4 mt-auto">
                    <Button
                      variant="ghost"
                      @click="handleLogout"
                      class="flex w-full justify-start items-center gap-x-4 px-6 py-6 text-sm/6 font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-none"
                    >
                      <LogOut class="size-5 shrink-0" aria-hidden="true" />
                      {{ t('nav.logout') }}
                    </Button>
                    <div class="px-6 mt-2 text-xs text-muted-foreground/80">
                      Web {{ appVersion }}<span v-if="serverVersion"> · Srv {{ serverVersion }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>

      <!-- Desktop Sidebar -->
      <div class="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex md:flex-col md:w-64 md:overflow-y-auto md:pb-4 overflow-x-hidden border-r border-border bg-surface-high">
        <!-- Logo -->
        <RouterLink to="/" class="flex h-16 shrink-0 items-center px-3 gap-3 transition-opacity hover:opacity-80">
          <img src="/favicon.png" alt="LuxStage" class="h-9 w-9 rounded-xl shrink-0" />
          <span class="text-sm font-bold text-foreground">LuxStage</span>
        </RouterLink>

        <!-- Hauptnavigation -->
        <nav class="mt-2 flex-1">
          <ul role="list" class="flex flex-col gap-1 px-2">
            <li v-for="item in navigation.slice(0, 1)" :key="item.name" class="w-full">
              <RouterLink
                :to="item.to"
                class="group relative flex items-center gap-3 rounded-lg px-3 h-9 w-full transition-colors"
                :class="[isActiveRoute(item) ? 'text-foreground bg-muted' : 'text-muted-foreground nav-hover']"
              >
                <span v-if="isActiveRoute(item)" class="absolute left-0 top-1.25 bottom-1.25 w-0.75 rounded-full bg-accent" />
                <div class="shrink-0 rounded-md p-1">
                  <component :is="item.icon" class="size-4" aria-hidden="true" />
                </div>
                <span v-if="item.badge?.value" class="absolute top-1 right-1 size-2 rounded-full bg-accent" />
                <span class="text-sm" :class="isActiveRoute(item) ? 'font-semibold' : 'font-medium'">{{ item.name }}</span>
              </RouterLink>

              <!-- Show-Sub-Nav unterhalb von Shows -->
              <div v-if="item.to === '/' && isShowDetail && navItems.length" class="mt-1 ml-2 border-l border-border/30 pl-1 flex flex-col gap-0.5 items-stretch">
                <template v-for="sub in navItems" :key="sub.key ?? sub.type + sub.label">
                  <div v-if="sub.type === 'group'" class="px-2 pt-4 pb-1">
                    <div class="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">{{ sub.label }}</div>
                  </div>
                  <button
                    v-else-if="sub.type === 'addSection'"
                    class="group relative flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border h-9 w-full text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors"
                    @click="showNavAddSection()"
                  >
                    <span class="text-sm leading-none">+</span>
                    <span class="text-sm">{{ sub.label }}</span>
                  </button>
                  <div
                    v-else
                    class="group relative flex items-center gap-1 rounded-lg pl-3 pr-1 h-9 w-full transition-colors"
                    :class="[sub.active ? 'text-foreground bg-muted' : 'text-muted-foreground nav-hover']"
                  >
                    <span v-if="sub.active" class="absolute left-0 top-1.25 bottom-1.25 w-0.75 rounded-full bg-accent" />
                    <button class="flex-1 min-w-0 text-left" @click="showNavNavigate(sub)">
                      <span class="text-sm" :class="sub.active ? 'font-semibold' : ''">{{ sub.label }}</span>
                    </button>
                    <Button
                      v-if="sub.sectionId"
                      variant="ghost"
                      size="icon"
                      class="size-6 shrink-0 rounded-sm text-muted-foreground/50"
                      @click="showNavDeleteSection(sub.sectionId)"
                    >
                      <X class="size-3.5" />
                    </Button>
                  </div>
                </template>
              </div>
            </li>
          </ul>
        </nav>

        <!-- Archiv, Templates, Settings, Logout -->
        <div class="flex flex-col gap-1 px-2">
          <RouterLink
            v-for="item in navigation.slice(1)"
            :key="item.name"
            :to="item.to"
            class="group relative flex items-center gap-3 rounded-lg px-3 h-9 w-full transition-colors"
            :class="[isActiveRoute(item) ? 'text-foreground bg-muted' : 'text-muted-foreground nav-hover']"
          >
            <span v-if="isActiveRoute(item)" class="absolute left-0 top-1.25 bottom-1.25 w-0.75 rounded-full bg-accent" />
            <div class="shrink-0 rounded-md p-1">
              <component :is="item.icon" class="size-4" aria-hidden="true" />
            </div>
            <span class="text-sm" :class="isActiveRoute(item) ? 'font-semibold' : 'font-medium'">{{ item.name }}</span>
          </RouterLink>

          <div class="my-1 border-t border-border" />

          <RouterLink
            to="/settings"
            class="group relative flex items-center gap-3 rounded-lg px-3 h-9 w-full transition-colors overflow-hidden"
            :class="[isSettingsDetail ? 'text-foreground bg-muted' : 'text-muted-foreground nav-hover']"
          >
            <span v-if="isSettingsDetail" class="absolute left-0 top-1.25 bottom-1.25 w-0.75 rounded-full bg-accent" />
            <div class="shrink-0 rounded-md p-1">
              <Settings class="size-4" aria-hidden="true" />
            </div>
            <span v-if="updateAvailable" class="absolute top-1 right-1 size-2 rounded-full bg-accent" />
            <span class="text-sm" :class="isSettingsDetail ? 'font-semibold' : 'font-medium'">{{ t('nav.settings') }}</span>
          </RouterLink>

          <!-- Settings-Sub-Nav unterhalb von Einstellungen -->
          <div v-if="isSettingsDetail" class="ml-2 border-l border-border/30 pl-1 flex flex-col gap-0.5 items-stretch">
            <RouterLink
              v-for="item in settingsNavItems"
              :key="item.to"
              :to="item.to"
              class="group relative flex items-center gap-3 rounded-lg px-3 h-9 w-full transition-colors"
              :class="[isSettingsItemActive(item.to) ? 'text-foreground bg-muted' : 'text-muted-foreground nav-hover']"
            >
              <span v-if="isSettingsItemActive(item.to)" class="absolute left-0 top-1.25 bottom-1.25 w-0.75 rounded-full bg-accent" />
              <span class="text-sm" :class="isSettingsItemActive(item.to) ? 'font-semibold' : ''">{{ item.label }}</span>
            </RouterLink>
          </div>

          <button
            @click="handleLogout"
            class="group flex items-center gap-3 rounded-lg px-3 h-9 w-full text-muted-foreground nav-hover transition-colors overflow-hidden"
          >
            <div class="shrink-0 rounded-md p-1">
              <LogOut class="size-4" aria-hidden="true" />
            </div>
            <span class="text-sm font-medium">{{ t('nav.logout') }}</span>
          </button>
        </div>
      </div>

      <!-- Mobile Top-Bar -->
      <div class="sticky top-0 z-40 flex items-center gap-x-6 bg-background px-4 py-4 shadow-xs sm:px-6 md:hidden border-b border-border">
        <Button variant="ghost" size="icon" class="-m-2.5 p-2.5 text-muted-foreground lg:hidden" @click="sidebarOpen = true">
          <span class="sr-only">Sidebar öffnen</span>
          <Menu class="size-6" aria-hidden="true" />
        </Button>
        <RouterLink to="/" class="flex items-center gap-2 flex-1 transition-opacity hover:opacity-80">
          <img src="/favicon.png" alt="LuxStage" class="h-7 w-7 rounded-lg" />
          <span class="text-sm/6 font-semibold text-foreground">LuxStage</span>
        </RouterLink>
      </div>

      <!-- Main Content -->
      <main class="bg-background h-dvh overflow-y-auto md:pl-64">
        <!-- Offline-Banner -->
        <Alert v-if="!isOnline" variant="destructive" class="sticky top-0 z-50 rounded-none border-x-0 border-t-0 py-2">
          <AlertTriangle class="size-4" />
          <AlertDescription>{{ t('offline.banner') }}</AlertDescription>
        </Alert>
        <RouterView />
      </main>
    </div>
    <!-- Global Confirm Dialog -->
    <ConfirmDialog
      :open="confirmState.open.value"
      :title="confirmState.title.value"
      :message="confirmState.message.value"
      :confirmLabel="confirmState.confirmLabel.value"
      :cancelLabel="confirmState.cancelLabel.value"
      @confirm="resolveConfirm(true)"
      @cancel="resolveConfirm(false)"
    />
  </div>
  </TooltipProvider>
  </TolgeeProvider>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { TolgeeProvider } from '@tolgee/vue'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Menu,
  X,
  LogOut,
  Layers,
  Archive,
  Files,
  Settings,
  AlertTriangle,
} from 'lucide-vue-next'
import { useLocale } from './composables/useLocale.js'
import { logout, api, isOnline } from './api/client.js'
import { useTokenRefresh } from './composables/useTokenRefresh.js'
import { jwtDecode } from './api/jwtDecode.js'
import { updateAvailable } from './composables/useUpdateCheck.js'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { useConfirmDialog, resolveConfirm } from './composables/useConfirm.js'
import { useShowNav } from './composables/useShowNav.js'

const confirmState = useConfirmDialog()
const { navItems, navigate: showNavNavigate, addSection: showNavAddSection, deleteSection: showNavDeleteSection } = useShowNav()
const isShowDetail = computed(() => route.path.startsWith('/shows/') && route.path !== '/shows')
useTokenRefresh()

const { t } = useLocale()
const appVersion = __APP_VERSION__
const serverVersion = ref(null)
const saasMode = ref(false)

async function pingServer() {
  try {
    const status = await api.get('/api/status')
    isOnline.value = true
    serverVersion.value = status.version
    saasMode.value = !!status.saasEnabled
  } catch {
    isOnline.value = false
  }
}

async function checkForUpdate() {
  try {
    const token = localStorage.getItem('luxstage_token')
    const isAdmin = token && jwtDecode(token)?.role === 'admin'
    if (!isAdmin) return
    const check = await api.get('/api/update/check')
    if (check?.available) updateAvailable.value = true
  } catch (e) {
    console.warn('[LuxStage] Update-Check fehlgeschlagen:', e)
  }
}

let updateCheckInterval = null
let pingInterval = null

onUnmounted(() => {
  clearInterval(updateCheckInterval)
  clearInterval(pingInterval)
})

onMounted(async () => {
  void pingServer()
  pingInterval = setInterval(pingServer, 30_000)

  void checkForUpdate()
  updateCheckInterval = setInterval(checkForUpdate, 60 * 60 * 1000)
})

const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)

watch(route, () => { sidebarOpen.value = false })

function isActiveRoute(item) {
  if (item.to === '/') {
    return route.path === '/' || route.path.startsWith('/shows')
  }
  return route.path.startsWith(item.to)
}

const navigation = computed(() => [
  { name: t('nav.shows'), to: '/', routeName: 'shows', icon: Layers },
  { name: t('nav.archive'), to: '/archive', routeName: 'archive', icon: Archive },
  { name: t('nav.templates'), to: '/templates', routeName: 'templates', icon: Files },
])

const isSettingsDetail = computed(() => route.path.startsWith('/settings'))

const isAdmin = computed(() => {
  try {
    const token = localStorage.getItem('luxstage_token')
    return token ? jwtDecode(token)?.role === 'admin' : false
  } catch { return false }
})

const settingsNavItems = computed(() => [
  { to: '/settings/account', label: t('settings.account') },
  { to: '/settings/display', label: t('settings.display') },
  ...(isAdmin.value ? [{ to: '/settings/backup', label: t('settings.backup') }] : []),
  ...(isAdmin.value ? [{ to: '/settings/users', label: 'Benutzerverwaltung' }] : []),
  // Server/SMTP/Update sind Self-Hosted-Einstellungen: im SaaS-Modus liegen
  // Server-Betrieb, zentrales SMTP und Updates beim Betreiber, nicht beim Mandanten.
  ...(isAdmin.value && !saasMode.value ? [{ to: '/settings/server', label: t('settings.server') }] : []),
  ...(isAdmin.value && !saasMode.value ? [{ to: '/settings/smtp', label: t('settings.smtp') }] : []),
  ...(isAdmin.value && !saasMode.value ? [{ to: '/settings/update', label: t('settings.update') }] : []),
])

function isSettingsItemActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s linear;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease-in-out;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

.nav-hover:hover {
  background-color: hsl(var(--muted) / 0.6);
  color: hsl(var(--foreground));
}
</style>

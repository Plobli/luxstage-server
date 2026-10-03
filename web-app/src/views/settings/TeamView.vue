<template>
  <div class="divide-y divide-border">

    <!-- Zugang -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.team.status') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.team.status.hint') }}</p>
      </div>
      <div class="md:col-span-2" v-if="status">
        <div class="flex items-center gap-3 text-sm">
          <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="stateClass">
            {{ t('settings.team.state.' + status.state) }}
          </span>
          <span v-if="untilText" class="text-muted-foreground">{{ untilText }}</span>
        </div>
        <p v-if="status.state === 'readonly'" class="mt-3 text-sm text-muted-foreground">
          {{ t('settings.team.readonly.hint') }}
        </p>
      </div>
    </div>

    <!-- Inhaber -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.team.owner') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.team.owner.hint') }}</p>
      </div>
      <div class="md:col-span-2" v-if="status">
        <p class="text-sm text-foreground">
          {{ status.ownerUsername ? t('settings.team.owner.current', { username: status.ownerUsername }) : t('settings.team.owner.none') }}
        </p>

        <form v-if="status.owner && candidates.length" class="mt-6 sm:max-w-xl" @submit.prevent="doTransfer">
          <div class="space-y-2">
            <Label for="new-owner">{{ t('settings.team.owner.transfer.to') }}</Label>
            <select id="new-owner" v-model="newOwner" required
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="" disabled>–</option>
              <option v-for="u in candidates" :key="u.username" :value="u.username">{{ u.username }}</option>
            </select>
          </div>
          <Alert v-if="msg" :variant="msg.startsWith('✓') ? 'default' : 'destructive'" class="mt-3">
            <AlertDescription>{{ msg }}</AlertDescription>
          </Alert>
          <div class="mt-6">
            <Button type="submit" variant="outline" :disabled="!newOwner || loading">
              {{ loading ? '…' : t('settings.team.owner.transfer') }}
            </Button>
          </div>
        </form>
        <p v-else-if="!status.owner" class="mt-3 text-sm text-muted-foreground">{{ t('settings.team.owner.only') }}</p>
      </div>
    </div>

    <!-- Abrechnung: folgt mit Stripe (status.billingEnabled) -->

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLocale } from '../../composables/useLocale.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { getTeamStatus, transferTeamOwner } from '../../api/team.js'
import { listUsers } from '../../api/users.js'

const { t } = useLocale()
const { confirm } = useConfirm()

const status = ref(null)
const users = ref([])
const newOwner = ref('')
const msg = ref('')
const loading = ref(false)

const candidates = computed(() => users.value.filter(u => !u.pending && !u.isOwner))

const stateClass = computed(() => ({
  trial: 'bg-amber-500/10 text-amber-600',
  active: 'bg-emerald-500/10 text-emerald-600',
  readonly: 'bg-destructive/10 text-destructive',
}[status.value?.state] ?? ''))

const untilText = computed(() => {
  const until = status.value?.accessUntil
  if (!until || status.value.state === 'readonly') return ''
  return t('settings.team.until', { date: new Date(until).toLocaleDateString() })
})

async function load() {
  try {
    status.value = await getTeamStatus()
    users.value = await listUsers()
  } catch { /* ignore */ }
}

async function doTransfer() {
  const username = newOwner.value
  const ok = await confirm({ t, titleKey: 'settings.team.owner.transfer.confirm', messageParams: { username }, confirmKey: 'settings.team.owner.transfer', cancelKey: 'action.cancel' })
  if (!ok) return
  msg.value = ''
  loading.value = true
  try {
    await transferTeamOwner(username)
    msg.value = t('settings.team.owner.transfer.success')
    newOwner.value = ''
    await load()
  } catch (e) {
    msg.value = t('settings.team.error', { message: e.message })
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

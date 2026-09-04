<template>
  <div class="divide-y divide-border">

    <!-- Benutzerliste -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.users') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.users.hint') }}</p>
      </div>
      <div class="md:col-span-2">
        <ul class="divide-y divide-border text-sm">
          <li v-for="u in users" :key="u.username" class="flex items-center justify-between py-3">
            <div class="flex items-center gap-3">
              <span class="text-foreground font-medium">{{ u.username }}</span>
              <span v-if="u.pending" class="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                {{ t('settings.users.pending') }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Button v-if="u.pending" variant="outline" size="sm" @click="doApproveUser(u.username)">
                {{ t('settings.users.approve') }}
              </Button>
              <Button v-if="u.source === 'db'" variant="ghost" size="sm" @click="doDeleteUser(u.username)"
                class="text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                {{ t('settings.users.delete') }}
              </Button>
            </div>
          </li>
        </ul>
        <Alert v-if="deleteMsg" :variant="deleteMsg.startsWith('✓') ? 'default' : 'destructive'" class="mt-3">
          <AlertDescription>{{ deleteMsg }}</AlertDescription>
        </Alert>
      </div>
    </div>

    <!-- Neuer Benutzer -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.users.new') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.users.new.hint') }}</p>
      </div>
      <form class="md:col-span-2" @submit.prevent="doCreateUser">
        <div class="space-y-4 sm:max-w-xl">
          <div class="space-y-2">
            <Label for="new-username">{{ t('settings.users.username') }}</Label>
            <Input id="new-username" v-model="newUsername" type="email" required autocomplete="off" />
          </div>
          <Alert v-if="usersMsg" :variant="usersMsg.startsWith('✓') ? 'default' : 'destructive'">
            <AlertDescription>{{ usersMsg }}</AlertDescription>
          </Alert>
        </div>
        <div class="mt-8">
          <Button type="submit" :disabled="usersLoading">
            {{ usersLoading ? '…' : t('settings.users.create') }}
          </Button>
        </div>
      </form>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLocale } from '../../composables/useLocale.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { listUsers, createUser, deleteUser, approveUser } from '../../api/users.js'

const { t } = useLocale()
const { confirm } = useConfirm()

const users = ref([])
const deleteMsg = ref('')
const newUsername = ref('')
const usersMsg = ref('')
const usersLoading = ref(false)

async function loadUsers() {
  try { users.value = await listUsers() } catch { /* ignore */ }
}

async function doCreateUser() {
  usersMsg.value = ''
  usersLoading.value = true
  try {
    await createUser(newUsername.value)
    usersMsg.value = t('settings.users.success')
    newUsername.value = ''
    await loadUsers()
  } catch (e) {
    usersMsg.value = t('settings.users.error', { message: e.message })
  } finally {
    usersLoading.value = false
  }
}

async function doApproveUser(username) {
  try {
    await approveUser(username)
    await loadUsers()
  } catch (e) {
    deleteMsg.value = t('settings.users.error', { message: e.message })
  }
}

async function doDeleteUser(username) {
  const ok = await confirm({ t, titleKey: 'settings.users.delete.confirm', messageParams: { username }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  try {
    await deleteUser(username)
    await loadUsers()
  } catch (e) {
    deleteMsg.value = t('settings.users.error', { message: e.message })
  }
}

onMounted(loadUsers)
</script>

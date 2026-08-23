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
              <Badge :variant="u.role === 'admin' ? 'default' : 'secondary'">{{ t('settings.users.role.' + u.role) }}</Badge>
            </div>
            <Button v-if="u.source === 'db'" variant="ghost" size="sm" @click="doDeleteUser(u.username)"
              class="text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
              {{ t('settings.users.delete') }}
            </Button>
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
          <div class="space-y-2">
            <Label for="new-role">{{ t('settings.users.role') }}</Label>
            <Select v-model="newRole">
              <SelectTrigger id="new-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="techniker">{{ t('settings.users.role.techniker') }}</SelectItem>
                <SelectItem value="admin">{{ t('settings.users.role.admin') }}</SelectItem>
              </SelectContent>
            </Select>
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

    <!-- Passwort zurücksetzen -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.account.reset_password') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.users.reset_password.hint') }}</p>
      </div>
      <form class="md:col-span-2" @submit.prevent="doResetPassword">
        <div class="sm:max-w-xl space-y-2">
          <Label for="reset-username">{{ t('settings.account.reset_password.username') }}</Label>
          <Input id="reset-username" v-model="resetUsername" type="text" required />
          <Alert v-if="resetMsg" :variant="resetMsg.startsWith('✓') ? 'default' : 'destructive'" class="mt-3">
            <AlertDescription class="font-mono">{{ resetMsg }}</AlertDescription>
          </Alert>
        </div>
        <div class="mt-8">
          <Button type="submit" :disabled="resetLoading">
            {{ resetLoading ? '…' : t('settings.account.reset_password.submit') }}
          </Button>
        </div>
      </form>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLocale } from '../../composables/useLocale.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { listUsers, createUser, deleteUser, resetPassword } from '../../api/client.js'

const { t } = useLocale()
const { confirm } = useConfirm()

const users = ref([])
const deleteMsg = ref('')
const newUsername = ref('')
const newRole = ref('techniker')
const usersMsg = ref('')
const usersLoading = ref(false)
const resetUsername = ref('')
const resetMsg = ref('')
const resetLoading = ref(false)

async function loadUsers() {
  try { users.value = await listUsers() } catch { /* ignore */ }
}

async function doCreateUser() {
  usersMsg.value = ''
  usersLoading.value = true
  try {
    await createUser(newUsername.value, newRole.value)
    usersMsg.value = t('settings.users.success')
    newUsername.value = ''; newRole.value = 'techniker'
    await loadUsers()
  } catch (e) {
    usersMsg.value = t('settings.users.error', { message: e.message })
  } finally {
    usersLoading.value = false
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

async function doResetPassword() {
  resetMsg.value = ''
  resetLoading.value = true
  try {
    const { newPassword: pw } = await resetPassword(resetUsername.value)
    resetMsg.value = t('settings.account.reset_password.success', { password: pw })
  } catch (e) {
    resetMsg.value = t('settings.account.reset_password.error', { message: e.message })
  } finally {
    resetLoading.value = false
  }
}

onMounted(loadUsers)
</script>

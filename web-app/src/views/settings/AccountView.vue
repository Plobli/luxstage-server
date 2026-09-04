<template>
  <div class="divide-y divide-border">

    <!-- Force-change Banner -->
    <div v-if="forceChange" class="px-4 py-4 sm:px-6 lg:px-8 bg-amber-50 dark:bg-amber-950/30">
      <Alert variant="destructive">
        <AlertDescription>{{ t('settings.account.force_change') }}</AlertDescription>
      </Alert>
    </div>

    <!-- Passwort ändern -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.account.change_password') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.account.change_password.hint') }}</p>
      </div>
      <form class="md:col-span-2" @submit.prevent="doChangePassword">
        <div class="grid grid-cols-1 gap-x-6 gap-y-6 sm:max-w-xl">
          <div class="space-y-2">
            <Label for="pw-current">{{ t('settings.account.current_password') }}</Label>
            <Input id="pw-current" v-model="pwCurrent" type="password" required autocomplete="current-password" />
          </div>
          <div class="space-y-2">
            <Label for="pw-new">{{ t('settings.account.new_password') }}</Label>
            <Input id="pw-new" v-model="pwNew" type="password" required autocomplete="new-password" />
          </div>
          <div class="space-y-2">
            <Label for="pw-confirm">{{ t('settings.account.new_password.confirm') }}</Label>
            <Input id="pw-confirm" v-model="pwConfirm" type="password" required autocomplete="new-password" />
          </div>
          <Alert v-if="pwMsg" :variant="pwMsg.startsWith('✓') ? 'default' : 'destructive'">
            <AlertDescription>{{ pwMsg }}</AlertDescription>
          </Alert>
        </div>
        <div class="mt-8">
          <Button type="submit" :disabled="pwLoading">
            {{ pwLoading ? '…' : t('settings.account.change_password.submit') }}
          </Button>
        </div>
      </form>
    </div>

    <!-- Abmelden -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.logout') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.account.logout.hint') }}</p>
      </div>
      <div class="md:col-span-2 flex items-start">
        <Button variant="outline" type="button" @click="handleLogout">
          {{ t('settings.logout') }}
        </Button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useLocale } from '../../composables/useLocale.js'
import { logout, changePassword } from '../../api/auth.js'
import { PASSWORD_MIN_LENGTH } from '@shared/constants.js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const { t } = useLocale()
const router = useRouter()
const route = useRoute()
const forceChange = computed(() => route.query.forceChange === '1')

const pwCurrent = ref('')
const pwNew = ref('')
const pwConfirm = ref('')
const pwMsg = ref('')
const pwLoading = ref(false)

async function doChangePassword() {
  pwMsg.value = ''
  if (pwNew.value.length < PASSWORD_MIN_LENGTH) { pwMsg.value = t('settings.account.change_password.error.short', { min: PASSWORD_MIN_LENGTH }); return }
  if (pwNew.value !== pwConfirm.value) { pwMsg.value = t('settings.account.change_password.error.mismatch'); return }
  pwLoading.value = true
  try {
    await changePassword(pwCurrent.value, pwNew.value)
    pwMsg.value = t('settings.account.change_password.success')
    pwCurrent.value = ''; pwNew.value = ''; pwConfirm.value = ''
    if (forceChange.value) router.replace('/')
  } catch (e) {
    pwMsg.value = e.message.includes('403') || e.message.toLowerCase().includes('falsch')
      ? t('settings.account.change_password.error.wrong')
      : e.message
  } finally {
    pwLoading.value = false
  }
}

function handleLogout() {
  logout()
  router.push('/login')
}
</script>

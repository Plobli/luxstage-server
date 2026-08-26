<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12">

        <!-- Login-Formular -->
        <form class="space-y-6" @submit.prevent="handleLogin">
          <div class="space-y-2">
            <Label for="username">{{ t('auth.username') }}</Label>
            <Input
              v-model="username"
              id="username"
              type="email"
              autocomplete="email"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="password">{{ t('auth.password') }}</Label>
            <Input
              v-model="password"
              id="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <Alert v-if="pending" variant="default">
            <AlertDescription>{{ t('auth.login.pending') }}</AlertDescription>
          </Alert>
          <Alert v-else-if="error" variant="destructive">
            <AlertDescription>{{ t('auth.login.error') }}</AlertDescription>
          </Alert>

          <Button
            type="submit"
            :disabled="loading"
            class="w-full"
          >
            {{ loading ? '…' : t('auth.login.submit') }}
          </Button>

          <!-- Ohne SMTP läuft der Self-Service ins Leere (Mail wird nie zugestellt),
               deshalb dann stattdessen der Verweis auf den Administrator. -->
          <div class="text-center space-y-2">
            <div v-if="smtpConfigured">
              <RouterLink to="/forgot-password" class="text-sm text-muted-foreground hover:text-foreground">
                {{ t('auth.reset') }}
              </RouterLink>
            </div>
            <p v-else class="text-xs text-muted-foreground">{{ t('auth.reset.hint') }}</p>
            <div>
              <RouterLink to="/self-register" class="text-sm text-muted-foreground hover:text-foreground">
                {{ t('auth.self_register.link') }}
              </RouterLink>
            </div>
          </div>
        </form>

      </Card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { login, api, isOnline, isPendingApprovalError } from '../api/client.js'
import { useLocale } from '../composables/useLocale.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const router = useRouter()
const { t } = useLocale()
const username = ref('')
const password = ref('')
const error = ref(false)
const pending = ref(false)
const loading = ref(false)
// Bis der Status vorliegt (und wenn er nicht abrufbar ist) gilt „kein SMTP" —
// dann steht der Admin-Hinweis da statt eines Links, der ins Leere führt.
const smtpConfigured = ref(false)

onMounted(async () => {
  try {
    const caps = await api.get('/api/auth/capabilities')
    smtpConfigured.value = !!caps?.passwordReset
  } catch { /* Server nicht erreichbar — Hinweis bleibt stehen */ }
})

async function pingServer() {
  try {
    await api.get('/api/status')
    isOnline.value = true
  } catch {
    isOnline.value = false
  }
}

async function handleLogin() {
  error.value = false
  pending.value = false
  loading.value = true
  try {
    const { requiresPasswordChange } = await login(username.value, password.value)
    await pingServer()
    router.push(requiresPasswordChange ? { path: '/settings/account', query: { forceChange: '1' } } : '/')
  } catch (e) {
    if (isPendingApprovalError(e)) pending.value = true
    else error.value = true
  } finally {
    loading.value = false
  }
}
</script>

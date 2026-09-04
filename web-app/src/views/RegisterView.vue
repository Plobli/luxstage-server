<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
      <h1 class="mt-6 text-center text-xl font-semibold text-foreground">{{ t('register.title') }}</h1>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12">

        <!-- Erfolg: Opt-In-Hinweis -->
        <div v-if="done" class="space-y-4 text-center">
          <h2 class="text-base font-semibold text-foreground">{{ t('register.done.title') }}</h2>
          <p class="text-sm text-muted-foreground">
            {{ t('register.done.message', { email, team: teamId }) }}
          </p>
          <p class="text-xs text-muted-foreground">{{ t('register.done.hint') }}</p>
        </div>

        <!-- Registrierungs-Formular -->
        <form v-else class="space-y-6" @submit.prevent="handleRegister">
          <div class="space-y-2">
            <Label for="teamId">{{ t('register.team_id') }}</Label>
            <Input
              :model-value="teamId"
              @update:model-value="teamId = normalizeTeamId(String($event))"
              id="teamId"
              type="text"
              autocomplete="off"
              :placeholder="t('register.team_id.placeholder')"
              required
            />
            <p class="text-xs text-muted-foreground">
              {{ t('register.team_id.domain_hint') }} <span class="font-mono">{{ teamId || t('register.team_id.placeholder_short') }}.luxstage.app</span>
            </p>
          </div>

          <div class="space-y-2">
            <Label for="email">{{ t('register.email') }}</Label>
            <Input
              v-model="email"
              id="email"
              type="email"
              autocomplete="email"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="password">{{ t('register.password') }}</Label>
            <Input
              v-model="password"
              id="password"
              type="password"
              autocomplete="new-password"
              required
            />
            <p class="text-xs text-muted-foreground">{{ t('register.password.hint', { min: PASSWORD_MIN_LENGTH }) }}</p>
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <Button type="submit" :disabled="loading" class="w-full">
            {{ loading ? '…' : t('register.submit') }}
          </Button>
        </form>

      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { register } from '../api/auth'
import { PASSWORD_MIN_LENGTH } from '@shared/constants.js'
import { useLocale } from '../composables/useLocale.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const { t } = useLocale()

const teamId = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

// Team-Kürzel live normalisieren: Kleinbuchstaben, nur a-z 0-9 Bindestrich.
function normalizeTeamId(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9-]/g, '')
}

async function handleRegister() {
  error.value = ''
  teamId.value = normalizeTeamId(teamId.value)
  if (teamId.value.length < 2) { error.value = t('register.error.team_id_short'); return }
  if (password.value.length < PASSWORD_MIN_LENGTH) { error.value = t('register.error.password_short', { min: PASSWORD_MIN_LENGTH }); return }
  loading.value = true
  try {
    await register(teamId.value, email.value, password.value)
    done.value = true
  } catch (e: any) {
    error.value = e?.message || t('register.error.generic')
  } finally {
    loading.value = false
  }
}
</script>

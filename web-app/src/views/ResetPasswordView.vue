<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
      <h1 class="mt-6 text-center text-xl font-semibold text-foreground">{{ t('reset.title') }}</h1>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12">

        <div v-if="done" class="space-y-4 text-center">
          <h2 class="text-base font-semibold text-foreground">{{ t('reset.done.title') }}</h2>
          <p class="text-sm text-muted-foreground">{{ t('reset.done.message') }}</p>
          <RouterLink to="/login" class="inline-block text-sm text-primary hover:text-primary/80">
            {{ t('reset.done.login_link') }}
          </RouterLink>
        </div>

        <div v-else-if="!token" class="space-y-4 text-center">
          <Alert variant="destructive" class="text-left">
            <AlertDescription>{{ t('reset.invalid_link') }}</AlertDescription>
          </Alert>
          <RouterLink to="/forgot-password" class="inline-block text-sm text-primary hover:text-primary/80">
            {{ t('reset.invalid_link.back') }}
          </RouterLink>
        </div>

        <form v-else class="space-y-6" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="pw">{{ t('reset.password') }}</Label>
            <Input v-model="password" id="pw" type="password" autocomplete="new-password" required />
            <p class="text-xs text-muted-foreground">{{ t('reset.password.hint', { min: PASSWORD_MIN_LENGTH }) }}</p>
          </div>
          <div class="space-y-2">
            <Label for="pw2">{{ t('reset.password2') }}</Label>
            <Input v-model="password2" id="pw2" type="password" autocomplete="new-password" required />
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <Button type="submit" :disabled="loading" class="w-full">
            {{ loading ? '…' : t('reset.submit') }}
          </Button>
        </form>

      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { confirmPasswordReset } from '../api/auth'
import { PASSWORD_MIN_LENGTH } from '@shared/constants.js'
import { useLocale } from '../composables/useLocale.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const { t } = useLocale()

const route = useRoute()
const token = ref(String(route.query.token || ''))
const password = ref('')
const password2 = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function handleSubmit() {
  error.value = ''
  if (password.value.length < PASSWORD_MIN_LENGTH) { error.value = t('reset.error.too_short', { min: PASSWORD_MIN_LENGTH }); return }
  if (password.value !== password2.value) { error.value = t('reset.error.mismatch'); return }
  loading.value = true
  try {
    await confirmPasswordReset(token.value, password.value)
    done.value = true
  } catch (e: any) {
    error.value = e?.message || t('reset.error.generic')
  } finally {
    loading.value = false
  }
}
</script>

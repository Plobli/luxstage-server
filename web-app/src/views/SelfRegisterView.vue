<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
      <h1 class="mt-6 text-center text-xl font-semibold text-foreground">{{ t('self_register.title') }}</h1>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12">

        <div v-if="done" class="space-y-4 text-center">
          <p class="text-sm text-muted-foreground">
            {{ t('self_register.done.message') }}
          </p>
          <RouterLink to="/login" class="inline-block text-sm text-primary hover:text-primary/80">
            {{ t('forgot.back_to_login') }}
          </RouterLink>
        </div>

        <form v-else class="space-y-6" @submit.prevent="handleSubmit">
          <p class="text-sm text-muted-foreground">
            {{ t('self_register.intro') }}
          </p>
          <div class="space-y-2">
            <Label for="email">{{ t('register.email') }}</Label>
            <Input v-model="email" id="email" type="email" autocomplete="email" required />
          </div>
          <div class="space-y-2">
            <Label for="password">{{ t('register.password') }}</Label>
            <Input v-model="password" id="password" type="password" autocomplete="new-password" required />
            <p class="text-xs text-muted-foreground">{{ t('register.password.hint', { min: PASSWORD_MIN_LENGTH }) }}</p>
          </div>

          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <Button type="submit" :disabled="loading" class="w-full">
            {{ loading ? '…' : t('self_register.submit') }}
          </Button>

          <div class="text-center">
            <RouterLink to="/login" class="text-sm text-muted-foreground hover:text-foreground">
              {{ t('forgot.back_to_login.inline') }}
            </RouterLink>
          </div>
        </form>

      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { selfRegister } from '../api/client'
import { useLocale } from '../composables/useLocale.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PASSWORD_MIN_LENGTH } from '@shared/constants.js'

const { t } = useLocale()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function handleSubmit() {
  error.value = ''
  if (password.value.length < PASSWORD_MIN_LENGTH) {
    error.value = t('register.error.password_short', { min: PASSWORD_MIN_LENGTH })
    return
  }
  loading.value = true
  try {
    await selfRegister(email.value, password.value)
    done.value = true
  } catch (e: any) {
    error.value = e?.message || t('self_register.error.generic')
  } finally {
    loading.value = false
  }
}
</script>

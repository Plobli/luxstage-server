<template>
  <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <img src="/favicon.png" alt="LuxStage" class="mx-auto h-16 w-16 rounded-2xl" />
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <Card class="px-6 py-8 sm:px-12 text-center space-y-4">

        <template v-if="loading">
          <h2 class="text-base font-semibold text-foreground">{{ t('confirm.loading') }}</h2>
        </template>

        <template v-else-if="tenantId">
          <h2 class="text-base font-semibold text-foreground">{{ t('confirm.success.title') }}</h2>
          <p class="text-sm text-muted-foreground">
            {{ t('confirm.success.message', { team: tenantId }) }}
          </p>
          <p v-if="trialDays" class="text-sm text-muted-foreground">
            {{ t('confirm.success.trial', { days: trialDays }) }}
          </p>

          <div class="space-y-3 pt-2 text-left">
            <a :href="loginUrl"
              class="block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90">
              {{ t('confirm.success.login_link') }}
            </a>

            <div class="rounded-lg border border-border p-4">
              <p class="text-sm font-medium text-foreground">{{ t('confirm.app.title') }}</p>
              <p class="mt-1 text-xs text-muted-foreground">{{ t('confirm.app.hint') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <a :href="APP_STORE_URL" target="_blank" rel="noopener"
                  class="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted">
                  {{ t('confirm.app.download') }}
                </a>
                <a :href="appLink"
                  class="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted">
                  {{ t('confirm.app.open') }}
                </a>
              </div>
              <p class="mt-3 text-xs text-muted-foreground">
                {{ t('confirm.app.manual') }} <span class="font-mono text-foreground">{{ tenantId }}</span>
              </p>
            </div>
          </div>
        </template>

        <template v-else>
          <h2 class="text-base font-semibold text-foreground">{{ t('confirm.error.title') }}</h2>
          <Alert variant="destructive" class="text-left">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
          <RouterLink to="/register" class="inline-block text-sm text-primary hover:text-primary/80">
            {{ t('confirm.error.retry_link') }}
          </RouterLink>
        </template>

      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { confirmRegistration } from '../api/auth'
import { useLocale } from '../composables/useLocale.js'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const { t } = useLocale()

const route = useRoute()
const loading = ref(true)
const tenantId = ref('')
const loginUrl = ref('/login')
const trialDays = ref<number | null>(null)
const APP_STORE_URL = 'https://apps.apple.com/app/luxstage/id6760355522'
const appLink = computed(() => `luxstage://connect?team=${encodeURIComponent(tenantId.value)}`)
const error = ref('')

onMounted(async () => {
  const token = String(route.query.token || '')
  if (!token) {
    error.value = t('confirm.error.no_token')
    loading.value = false
    return
  }
  try {
    const res = await confirmRegistration(token)
    tenantId.value = res.tenantId
    if (res.loginUrl) loginUrl.value = res.loginUrl + '/login'
    trialDays.value = res.trialDays ?? null
  } catch (e: any) {
    error.value = e?.message || t('confirm.error.invalid')
  } finally {
    loading.value = false
  }
})
</script>

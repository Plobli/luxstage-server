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
          <a :href="loginUrl" class="inline-block text-sm text-primary hover:text-primary/80">
            {{ t('confirm.success.login_link') }}
          </a>
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
import { ref, onMounted } from 'vue'
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
  } catch (e: any) {
    error.value = e?.message || t('confirm.error.invalid')
  } finally {
    loading.value = false
  }
})
</script>

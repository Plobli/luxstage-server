<template>
  <div class="divide-y divide-border">
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.smtp') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.smtp.hint') }}</p>
      </div>
      <form class="md:col-span-2" @submit.prevent="doSave">
        <div class="space-y-4 sm:max-w-xl">
          <div>
            <Label for="smtp-host">{{ t('settings.smtp.host') }}</Label>
            <Input size="lg" id="smtp-host" v-model="form.host" type="text" placeholder="mail.example.com" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <Label for="smtp-port">{{ t('settings.smtp.port') }}</Label>
              <Input size="lg" id="smtp-port" v-model="form.port" type="number" placeholder="587" />
            </div>
            <div class="flex items-end gap-2 pb-0.5">
              <Checkbox v-model="form.secure" />
              <Label for="smtp-secure">{{ t('settings.smtp.secure') }}</Label>
            </div>
          </div>
          <div>
            <Label for="smtp-user">{{ t('settings.smtp.user') }}</Label>
            <Input size="lg" id="smtp-user" v-model="form.user" type="text" autocomplete="off" />
          </div>
          <div>
            <Label for="smtp-pass">{{ t('settings.smtp.pass') }}</Label>
            <Input size="lg" id="smtp-pass" v-model="form.pass" type="password" :placeholder="passPlaceholder" autocomplete="new-password" />
          </div>
          <div>
            <Label for="smtp-from">{{ t('settings.smtp.from') }}</Label>
            <Input size="lg" id="smtp-from" v-model="form.from" type="text" placeholder="LuxStage <noreply@example.com>" />
          </div>
          <Alert v-if="msg" :variant="msg.startsWith('✓') ? 'default' : 'destructive'">
            <AlertDescription>{{ msg }}</AlertDescription>
          </Alert>
        </div>
        <div class="mt-8 flex gap-3">
          <Button type="submit" :disabled="loading">
            {{ loading ? '…' : t('settings.smtp.save') }}
          </Button>
          <Button type="button" variant="outline" :disabled="testLoading" @click="doTest">
            {{ testLoading ? '…' : t('settings.smtp.test') }}
          </Button>
        </div>
      </form>
    </div>

    <Dialog :open="testDialogOpen" @update:open="testDialogOpen = $event">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t('settings.smtp.test.dialog.title') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label for="smtp-test-to">{{ t('settings.smtp.test.dialog.label') }}</Label>
            <Input
              size="lg"
              id="smtp-test-to"
              v-model="testTo"
              type="email"
              autofocus
              @keydown.enter.prevent="confirmTest"
              @keydown.esc.prevent="testDialogOpen = false"
            />
            <p v-if="testToError" class="mt-2 text-sm text-destructive">{{ testToError }}</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" type="button" @click="testDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button type="button" :disabled="testLoading" @click="confirmTest">
            {{ testLoading ? '…' : t('settings.smtp.test') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { useLocale } from '../../composables/useLocale.js'
import { getSmtpConfig, saveSmtpConfig, testSmtpConfig } from '../../api/client.js'
import { jwtDecode } from '../../api/jwtDecode.js'
import { isValidEmail } from '@shared/constants.js'

const { t } = useLocale()

const form = ref({ host: '', port: '587', secure: false, user: '', pass: '', from: '' })
const passPlaceholder = ref('')
const msg = ref('')
const loading = ref(false)
const testLoading = ref(false)
const testDialogOpen = ref(false)
const testTo = ref('')
const testToError = ref('')

const userEmail = computed(() => {
  try {
    const token = localStorage.getItem('luxstage_token')
    return token ? jwtDecode(token)?.email || '' : ''
  } catch { return '' }
})

onMounted(async () => {
  try {
    const cfg = await getSmtpConfig()
    passPlaceholder.value = cfg.pass ? '••••••••' : ''
    form.value = { ...cfg, pass: '' }
  } catch { /* ignore */ }
})

async function doSave() {
  msg.value = ''
  loading.value = true
  try {
    await saveSmtpConfig(form.value)
    msg.value = t('settings.smtp.success')
    if (form.value.pass) passPlaceholder.value = '••••••••'
  } catch (e) {
    msg.value = t('settings.smtp.error', { message: e.message })
  } finally {
    loading.value = false
  }
}

function doTest() {
  testTo.value = userEmail.value || ''
  testToError.value = ''
  testDialogOpen.value = true
}

async function confirmTest() {
  const to = testTo.value.trim()
  if (!isValidEmail(to)) {
    testToError.value = t('settings.smtp.test.dialog.error')
    return
  }
  testDialogOpen.value = false
  msg.value = ''
  testLoading.value = true
  try {
    await testSmtpConfig(to)
    msg.value = t('settings.smtp.test.success')
  } catch (e) {
    msg.value = t('settings.smtp.error', { message: e.message })
  } finally {
    testLoading.value = false
  }
}
</script>

<template>
  <div class="divide-y divide-border">

    <!-- Backup herunterladen -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.backup') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.backup.hint') }}</p>
      </div>
      <div class="md:col-span-2 flex items-start">
        <Button
          type="button"
          @click="downloadBackup"
        >
          {{ t('settings.backup.download') }}
        </Button>
      </div>
    </div>

    <!-- Backup wiederherstellen -->
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.backup.restore') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.backup.restore.hint') }}</p>
      </div>
      <div class="md:col-span-2 sm:max-w-xl">
        <div class="flex items-center gap-3">
          <Button variant="outline" as-child>
            <label class="cursor-pointer">
              {{ t('settings.backup.restore.choose') }}
              <input type="file" accept=".zip" class="sr-only" @change="onRestoreFile" />
            </label>
          </Button>
          <span v-if="restoreFile" class="text-sm text-muted-foreground truncate max-w-xs">{{ restoreFile.name }}</span>
        </div>
        <div class="mt-4" v-if="restoreFile">
          <Button
            type="button"
            :disabled="restoreLoading"
            @click="doRestore"
            variant="destructive"
          >
            {{ restoreLoading ? '…' : t('settings.backup.restore.submit') }}
          </Button>
        </div>
        <Alert v-if="restoreMsg" :variant="restoreMsg.startsWith('✓') ? 'default' : 'destructive'" class="mt-3">
          <AlertDescription>{{ restoreMsg }}</AlertDescription>
        </Alert>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLocale } from '../../composables/useLocale.js'
import { useConfirm } from '../../composables/useConfirm.js'
import { downloadBackup, uploadRestore } from '../../api/backup.js'

const { t } = useLocale()
const { confirm } = useConfirm()

const restoreFile = ref(null)
const restoreLoading = ref(false)
const restoreMsg = ref('')

function onRestoreFile(e) {
  restoreFile.value = e.target.files[0] || null
  restoreMsg.value = ''
}

async function doRestore() {
  if (!restoreFile.value) return
  const ok = await confirm({ t, titleKey: 'settings.backup.restore.confirm', confirmKey: 'action.confirm', cancelKey: 'action.cancel' })
  if (!ok) return
  restoreLoading.value = true
  restoreMsg.value = ''
  try {
    await uploadRestore(restoreFile.value)
    restoreMsg.value = t('settings.backup.restore.success')
    restoreFile.value = null
  } catch (e) {
    restoreMsg.value = t('settings.backup.restore.error', { message: e.message })
  } finally {
    restoreLoading.value = false
  }
}
</script>

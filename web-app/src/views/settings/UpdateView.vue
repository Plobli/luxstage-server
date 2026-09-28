<template>
  <div class="divide-y divide-border">
    <div class="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 class="text-base/7 font-semibold text-foreground">{{ t('settings.update') }}</h2>
        <p class="mt-1 text-sm/6 text-muted-foreground">{{ t('settings.update.hint') }}</p>
      </div>
      <div class="md:col-span-2 space-y-4 sm:max-w-xl">
        <div class="flex items-center gap-3">
          <Label class="text-sm shrink-0">{{ t('settings.update.branch') }}</Label>
          <Select v-model="selectedBranch" @update:modelValue="onBranchChange" :disabled="updating || !availableBranches.length">
            <SelectTrigger class="w-45">
              <SelectValue :placeholder="t('settings.update.branch')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="b in availableBranches" :key="b" :value="b">{{ b }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="text-sm">
          <span v-if="checkLoading" class="text-muted-foreground">{{ t('settings.update.checking') }}</span>
          <span v-else-if="checkResult?.available" class="text-amber-500 font-medium">
            ↑ {{ t('settings.update.available', { commits: checkResult.commits }) }}
          </span>
          <span v-else-if="checkResult && !checkResult.available" class="text-green-600 dark:text-green-400">
            ✓ {{ t('settings.update.uptodate') }}
          </span>
          <span v-else-if="checkError" class="text-muted-foreground">{{ t('settings.update.check_failed') }}</span>
        </div>

        <pre v-if="checkResult?.log" class="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 whitespace-pre-wrap font-mono">{{ checkResult.log }}</pre>

        <div>
          <Button
            type="button"
            :disabled="updating || !checkResult?.available"
            @click="doUpdate"
          >
            {{ updating ? '…' : t('settings.update.run') }}
          </Button>
        </div>

        <!-- Update läuft -->
        <div v-if="updating || updateLog.length" class="rounded-lg bg-muted border border-border overflow-hidden">
          <!-- Header mit Spinner / Statuszeile -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Loader2 v-if="updating" class="size-4 shrink-0 animate-spin text-accent" />
            <span v-if="updating" class="text-sm font-medium text-foreground">{{ t('settings.update.run') }}…</span>
            <span v-else-if="!updateError" class="text-sm font-medium text-green-600 dark:text-green-400">{{ t('settings.update.success') }}</span>
            <span v-else class="text-sm font-medium text-destructive">✗ {{ t('settings.update.failed') }}</span>
          </div>

          <!-- Fortschrittsbalken (indeterminate, da die Update-Dauer nicht vorhersagbar ist) -->
          <div v-if="updating" class="h-0.5 w-full bg-muted overflow-hidden">
            <div class="h-full w-1/3 bg-primary indeterminate-bar" />
          </div>

          <!-- Terminal-Output -->
          <div ref="logEl" class="px-4 py-3 max-h-72 overflow-y-auto">
            <pre class="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">{{ updateLog.join('\n') }}<span v-if="updating" class="animate-pulse">▌</span></pre>
          </div>
        </div>

        <Alert v-if="updateMsg && updateError" variant="destructive">
          <AlertDescription>{{ updateMsg }}</AlertDescription>
        </Alert>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { Loader2 } from 'lucide-vue-next'
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
import { api, BASE } from '../../api/client.js'
import { updateAvailable } from '../../composables/useUpdateCheck.js'

const { t } = useLocale()

const updating = ref(false)
const updateMsg = ref('')
const updateError = ref(false)
const updateLog = ref([])
const checkLoading = ref(false)
const checkResult = ref(null)
const checkError = ref(false)
const selectedBranch = ref('')
const availableBranches = ref([])
const logEl = ref(null)

// Auto-scroll beim neuen Log-Eintrag
watch(updateLog, () => {
  nextTick(() => {
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  })
}, { deep: true })

async function loadBranches() {
  try {
    const { branches } = await api.get('/api/update/branches')
    if (branches?.length) {
      availableBranches.value = branches
      selectedBranch.value = branches[0]
      checkForUpdate()
    }
  } catch { /* ignore */ }
}

function onBranchChange() {
  checkResult.value = null
  checkForUpdate()
}

async function checkForUpdate() {
  checkLoading.value = true
  checkResult.value = null
  checkError.value = false
  try {
    checkResult.value = await api.get(`/api/update/check?branch=${encodeURIComponent(selectedBranch.value)}`)
  } catch {
    checkError.value = true
  } finally {
    checkLoading.value = false
  }
}

async function doUpdate() {
  updating.value = true
  updateMsg.value = ''
  updateError.value = false
  updateLog.value = []

  const token = localStorage.getItem('luxstage_token')
  try {
    const res = await fetch(`${BASE()}/api/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ branch: selectedBranch.value }),
    })

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE-Events aus dem Buffer parsen
      const parts = buffer.split('\n\n')
      buffer = parts.pop() // letztes unvollständiges Stück behalten

      for (const part of parts) {
        const eventMatch = part.match(/^event: (\w+)/)
        const dataMatch  = part.match(/^data: (.+)/m)
        if (!dataMatch) continue
        const eventName = eventMatch?.[1] ?? 'message'
        const data = JSON.parse(dataMatch[1])

        if (eventName === 'log') {
          updateLog.value.push(data.msg)
        } else if (eventName === 'done') {
          if (data.error) {
            updateError.value = true
            updateMsg.value = data.error
          } else {
            checkResult.value = null
            updateAvailable.value = false
          }
        }
      }
    }
  } catch (e) {
    updateError.value = true
    const msg = e.message || ''
    updateMsg.value = msg.includes('wiederhergestellt') || msg.includes('restored')
      ? t('settings.update.rollback')
      : t('settings.update.error', { message: msg })
  } finally {
    updating.value = false
  }
}

onMounted(() => loadBranches())
</script>

<style scoped>
.indeterminate-bar {
  animation: indeterminate-slide 1.2s ease-in-out infinite;
}
@keyframes indeterminate-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
</style>

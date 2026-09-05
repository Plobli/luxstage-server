<template>
  <Card class="mb-6">
    <CardHeader>
      <CardTitle class="text-base">{{ t('network.connections') }}</CardTitle>
    </CardHeader>
    <CardContent>
      <!-- Ein Grid pro Switch statt einer Tabelle — sonst steht "Von: Unifi-671d"
           bei 24 Ports 24x da, ohne echten Informationsgewinn. -->
      <div v-for="sw in switchNodes" :key="sw.id" class="mb-6 last:mb-0">
        <div class="flex items-center gap-2 mb-2">
          <NetworkIcon class="size-4 text-muted-foreground shrink-0" />
          <span class="text-sm font-medium">{{ sw.label || t('network.type.switch') }}</span>
          <span v-if="sw.is_main" class="text-[10px] uppercase tracking-wide text-primary font-medium">{{ t('network.main_switch') }}</span>
          <span v-if="sw.port_count" class="text-xs text-muted-foreground">({{ usedPortCount(sw) }}/{{ sw.port_count }})</span>
        </div>
        <div v-if="sw.port_count" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5">
          <div
            v-for="row in switchPortRows(sw)" :key="row.port"
            class="flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-1"
            :class="row.conn ? '' : 'bg-accent/10'"
          >
            <span class="text-xs text-muted-foreground w-5 shrink-0 tabular-nums text-right">{{ row.port }}</span>
            <Select :model-value="row.targetId || '__empty__'" @update:model-value="v => emit('setPortTarget', sw, row.port, v === '__empty__' ? null : v)">
              <SelectTrigger class="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">{{ t('network.port_empty') }}</SelectItem>
                <SelectItem v-for="n in portTargetOptions(sw)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-if="row.targetIsSwitch"
              class="h-7 w-12 text-xs shrink-0" :placeholder="t('network.port')"
              :model-value="row.targetPort"
              @change="e => emit('setPortTargetPort', row.conn, sw.id, e.target.value)"
            />
          </div>
        </div>
        <div v-else class="text-sm text-muted-foreground">{{ t('network.no_ports') }}</div>
      </div>

      <!-- Verbindungen ohne beteiligten Switch (z.B. Gerät direkt an Gerät). -->
      <template v-if="otherConnections.length || pendingConnections.length">
        <div class="text-sm font-medium mb-2" :class="switchNodes.length ? 'mt-2' : ''">{{ t('network.other_connections') }}</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('network.from') }}</TableHead>
              <TableHead>{{ t('network.to') }}</TableHead>
              <TableHead class="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="conn in otherConnections" :key="conn.id">
              <TableCell>
                <Select :model-value="conn.from_node_id" @update:model-value="v => emit('updateConnectionEndpoint', conn, 'from', v)">
                  <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="n in connectionPartnerOptions(conn.to_node_id)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select :model-value="conn.to_node_id" @update:model-value="v => emit('updateConnectionEndpoint', conn, 'to', v)">
                  <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="n in connectionPartnerOptions(conn.from_node_id)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="emit('removeConnection', conn)">
                  <Trash2 class="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
            <!-- Entwürfe: noch nicht gespeichert, solange nicht beide Elemente gewählt sind. -->
            <TableRow v-for="draft in pendingConnections" :key="draft.id" class="bg-primary/10">
              <TableCell>
                <Select :model-value="draft.from_node_id || undefined" @update:model-value="v => emit('commitPendingConnection', draft, { from_node_id: v })">
                  <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="n in connectionPartnerOptions(draft.to_node_id)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select :model-value="draft.to_node_id || undefined" @update:model-value="v => emit('commitPendingConnection', draft, { to_node_id: v })">
                  <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.pick_element')" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="n in connectionPartnerOptions(draft.from_node_id)" :key="n.id" :value="n.id">{{ n.label || t('network.type.' + n.type) }}</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="emit('removePendingConnection', draft)">
                  <Trash2 class="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </template>

      <Button variant="outline" size="sm" class="mt-3" :disabled="nodes.length < 2" @click="emit('addConnection')">
        <Plus class="size-3.5" /> {{ t('network.add_connection') }}
      </Button>
    </CardContent>
  </Card>
</template>

<script setup>
import { Plus, Trash2, Network as NetworkIcon } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const { t } = useLocale()

defineProps({
  nodes: { type: Array, required: true },
  switchNodes: { type: Array, required: true },
  otherConnections: { type: Array, required: true },
  pendingConnections: { type: Array, required: true },
  usedPortCount: { type: Function, required: true },
  switchPortRows: { type: Function, required: true },
  portTargetOptions: { type: Function, required: true },
  connectionPartnerOptions: { type: Function, required: true },
})

const emit = defineEmits([
  'setPortTarget',
  'setPortTargetPort',
  'updateConnectionEndpoint',
  'removeConnection',
  'commitPendingConnection',
  'removePendingConnection',
  'addConnection',
])
</script>

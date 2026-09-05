<template>
  <Card class="mb-6">
    <CardHeader class="flex flex-row items-center justify-between gap-4">
      <CardTitle class="text-base shrink-0">{{ t('network.elements') }}</CardTitle>
      <div class="relative w-56">
        <Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input :model-value="elementSearch" @update:model-value="emit('update:elementSearch', $event)" class="h-8 pl-7" :placeholder="t('action.search')" />
      </div>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-40">{{ t('network.type') }}</TableHead>
            <TableHead>{{ t('network.label') }}</TableHead>
            <TableHead class="w-56">{{ t('network.room') }}</TableHead>
            <TableHead class="w-28">{{ t('network.port_count') }}</TableHead>
            <TableHead class="w-28">{{ t('network.main_switch') }}</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="group in filteredGroupedNodes" :key="group.key">
            <TableRow class="bg-surface-high/40 hover:bg-surface-high/40 cursor-pointer select-none" @click="emit('toggleGroup', group.key)">
              <TableCell colspan="6" class="py-1.5">
                <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <component :is="isGroupCollapsed(group.key) ? ChevronRight : ChevronDown" class="size-3.5" />
                  {{ group.room || t('network.no_room') }}
                  <span class="text-xs font-normal">({{ group.nodes.length }})</span>
                </div>
              </TableCell>
            </TableRow>
            <template v-if="!isGroupCollapsed(group.key)">
              <TableRow v-for="node in group.nodes" :key="node.id" :class="node.id === newNodeId ? 'bg-primary/10' : ''">
                <TableCell>
                  <Select :model-value="node.type" @update:model-value="v => emit('saveNode', node, { type: v })">
                    <SelectTrigger class="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in nodeTypes" :key="opt" :value="opt">{{ t('network.type.' + opt) }}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <Input class="h-8" :model-value="node.label" @change="e => emit('saveNode', node, { label: e.target.value })" />
                    <span v-if="node.id === newNodeId" class="text-[10px] uppercase tracking-wide text-primary font-medium shrink-0">{{ t('network.new') }}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    v-if="editingRoomId === node.id"
                    class="h-8" autofocus
                    :model-value="node.room"
                    :placeholder="t('network.room')"
                    @keydown.enter="e => emit('confirmNewRoom', node, e.target.value)"
                    @blur="e => emit('confirmNewRoom', node, e.target.value)"
                  />
                  <Select v-else :model-value="node.room || undefined" @update:model-value="v => emit('roomSelect', node, v)">
                    <SelectTrigger class="h-8"><SelectValue :placeholder="t('network.no_room')" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="r in roomOptions" :key="r" :value="r">{{ r }}</SelectItem>
                      <SelectItem value="__new__">{{ t('network.new_room') }}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    v-if="node.type === 'switch'"
                    class="h-8" type="number" min="1"
                    :model-value="node.port_count"
                    @change="e => emit('saveNode', node, { port_count: e.target.value ? Number(e.target.value) : null })"
                  />
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell>
                  <Checkbox
                    v-if="node.type === 'switch'"
                    :model-value="!!node.is_main"
                    @update:model-value="v => emit('saveNode', node, { is_main: v ? 1 : 0 })"
                  />
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="emit('removeNode', node)">
                    <Trash2 class="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            </template>
          </template>
        </TableBody>
      </Table>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" class="mt-3">
            <Plus class="size-3.5" /> {{ t('network.add_element') }} <ChevronDown class="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem v-for="opt in nodeTypes" :key="opt" class="cursor-pointer" @click="emit('addNode', opt)">
            {{ t('network.type.' + opt) }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardContent>
  </Card>
</template>

<script setup>
import { Plus, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const { t } = useLocale()

defineProps({
  nodeTypes: { type: Array, required: true },
  elementSearch: { type: String, required: true },
  filteredGroupedNodes: { type: Array, required: true },
  isGroupCollapsed: { type: Function, required: true },
  newNodeId: { type: String, default: null },
  editingRoomId: { type: String, default: null },
  roomOptions: { type: Array, required: true },
})

const emit = defineEmits([
  'update:elementSearch',
  'toggleGroup',
  'saveNode',
  'confirmNewRoom',
  'roomSelect',
  'removeNode',
  'addNode',
])
</script>

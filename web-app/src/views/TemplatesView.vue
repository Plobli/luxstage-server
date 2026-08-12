<template>
  <div class="px-4 py-8 sm:px-6 lg:px-8">

    <!-- Detail-Ansicht (wenn eine Vorlage ausgewählt) -->
    <template v-if="editingName">
      <!-- Header -->
      <div class="flex items-center gap-x-4 mb-8">
        <Button variant="ghost" size="icon" class="text-muted-foreground" @click="editingName = null">
          <ArrowLeft class="size-5" />
        </Button>
        <template v-if="renamingName">
          <input
            ref="renameInput"
            v-model="renameValue"
            class="text-2xl font-semibold bg-transparent border-b border-primary outline-none text-foreground w-64"
            autofocus
            type="text"
            inputmode="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="none"
            spellcheck="false"
            @keydown.enter.prevent="commitRename"
            @keydown.escape="renamingName = false"
            @blur="commitRename"
            @input="fixCapitalization"
          />
          <span v-if="renameSaving" class="text-xs text-muted-foreground">…</span>
          <span v-if="renameError" class="text-xs text-destructive">{{ renameError }}</span>
        </template>
        <template v-else>
          <h1 class="text-2xl font-semibold text-foreground">{{ templateDisplayName(editingName) || editingName }}</h1>
          <Button variant="ghost" size="icon" class="text-muted-foreground" :title="t('template.rename')" @click="startRename">
            <Pencil class="size-4" />
          </Button>
        </template>
        <span v-if="detailSaving || sectionsSaving" class="text-xs text-muted-foreground">…</span>
      </div>

      <div v-if="detailLoading" class="text-sm text-muted-foreground">…</div>

      <template v-else>
        <div class="flex items-center gap-x-3 mb-6 max-w-sm">
          <Label for="oscHostInput" class="shrink-0 text-sm text-muted-foreground">OSC-IP</Label>
          <Input
            id="oscHostInput"
            v-model="editingOscHost"
            :placeholder="t('template.osc_host.placeholder')"
            class="font-mono text-sm"
            @blur="persistOscHost"
            @keydown.enter.prevent="persistOscHost"
          />
          <span v-if="oscSaving" class="text-xs text-muted-foreground shrink-0">…</span>
        </div>

        <Tabs v-model="activeTab" class="w-full">
          <div class="flex items-center border-b border-border mb-6">
          <TabsList class="flex-1 justify-start bg-transparent p-0 h-auto rounded-none border-none">
            <TabsTrigger value="channels" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
              {{ t('show.channels') }}
            </TabsTrigger>
            <TabsTrigger value="sections" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
              {{ t('sections.btn') }}
            </TabsTrigger>
            <TabsTrigger value="floorplan" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
              {{ t('tab.floorplan') }}
            </TabsTrigger>
            <TabsTrigger value="bars" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
              {{ t('tab.bars') }}
            </TabsTrigger>
            <TabsTrigger value="towers" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
              {{ t('tab.towers') }}
            </TabsTrigger>
          </TabsList>
          </div>

          <!-- Kanaltabelle -->
          <TabsContent value="channels" class="mt-0 outline-none">
            <div class="h-[calc(100vh-16rem)] overflow-hidden rounded-lg border border-border">
              <ChannelTable
                :channels="detailChannels"
                :groupedChannels="groupedChannels"
                :dupChannelNrs="emptySet"
                :channelStatusFn="() => 'default'"
                :toggleChannelStatusFn="() => {}"
                :allShowPhotos="[]"
                :labels="{
                  channel: t('field.channel'),
                  color: t('field.color'),
                  device: t('field.device'),
                  quantity: t('field.quantity'),
                  notes: t('field.notes'),
                  editPosition: t('channel.position.edit'),
                  noPosition: t('channel.no_position'),
                  add: t('channel.add'),
                  delete: t('action.delete'),
                  empty: t('channel.list.empty'),
                  channelNr: t('show.channel.nr'),
                  addressExample: t('show.channel.address.example'),
                  addPosition: t('channel.position.add'),
                  positionNamePlaceholder: t('channel.position.name.placeholder'),
                }"
                class="h-full"
                @change="persist()"
                @pushSnapshot="() => {}"
                @recordFocus="() => {}"
                @commitFocus="() => {}"
                @deleteChannel="deleteChannel($event)"
                @clearChannel="clearChannel($event)"
                @reorder="detailChannels.splice(0, detailChannels.length, ...$event)"
              />
            </div>
          </TabsContent>

          <!-- Sections-Editor -->
          <TabsContent value="sections" class="mt-0 outline-none space-y-4">
          <div class="flex justify-end">
            <Button variant="outline" size="sm" :disabled="applyingToShows === 'sections'" @click="handleApplyToAllShows('sections')">
              {{ applyingToShows === 'sections' ? '…' : t('template.apply_to_shows') }}
            </Button>
          </div>
          <div v-for="(sec, idx) in templateSections" :key="sec.id" class="border border-border rounded-lg p-4 space-y-3 bg-card">
            <div class="flex items-center gap-2">
              <div class="flex flex-col gap-0.5">
                <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground disabled:opacity-30" :disabled="idx === 0" @click="moveSection(idx, -1)">▲</Button>
                <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground disabled:opacity-30" :disabled="idx === templateSections.length - 1" @click="moveSection(idx, 1)">▼</Button>
              </div>
              <Input
                :model-value="sec.title"
                :placeholder="t('sections.title.placeholder')"
                @update:model-value="sec.title = $event"
                @change="persistSections"
                class="flex-1"
              />
              <Select :model-value="sec.type" @update:model-value="(value) => onTypeChange(sec, value)">
                <SelectTrigger class="w-45">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="markdown">{{ t('sections.type.markdown') }}</SelectItem>
                    <SelectItem value="kv-table" :disabled="hasKvTableType() && sec.type !== 'kv-table'">{{ t('sections.type.fields') }}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" class="shrink-0 text-muted-foreground" @click="deleteSection(idx)">✕</Button>
            </div>
            <div v-if="sec.type === 'kv-table' || sec.type === 'fields'" class="space-y-2 pl-6">
              <div v-for="(row, fidx) in (sec.rows ?? sec.fields ?? [])" :key="row.key" class="flex items-center gap-2">
                <Input
                  :model-value="row.label"
                  :placeholder="t('sections.field.label')"
                  @update:model-value="row.label = $event"
                  @change="persistSections"
                  class="flex-1"
                />
                <Button variant="ghost" size="icon" class="shrink-0 text-muted-foreground" @click="deleteField(sec, fidx)">✕</Button>
              </div>
              <Button variant="outline" size="sm" @click="addField(sec)">+ {{ t('sections.field.add') }}</Button>
            </div>
          </div>
          <Button variant="outline" size="sm" @click="addSection">+ {{ t('sections.add') }}</Button>
          </TabsContent>

          <!-- Zugstangen -->
          <TabsContent value="bars" class="mt-0 outline-none space-y-3">
            <div class="text-sm text-muted-foreground whitespace-pre-line">
              {{ t('zugstange.hint') }}
            </div>
            <div v-if="templateBars.length === 0" class="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-6 text-center">
              {{ t('zugstange.empty') }}
            </div>
            <div
              v-for="(bar, idx) in templateBars" :key="bar.id"
              class="rounded-md border bg-card transition-colors"
              :class="barDragOverId === bar.id ? 'border-primary bg-primary/5' : barDraggedId === bar.id ? 'opacity-40 border-border' : 'border-border'"
            >
              <!-- Bar-Header Zeile -->
              <div
                draggable="true"
                class="flex items-center gap-3 px-4 py-2.5 cursor-grab"
                @dragstart="onBarDragStart(bar.id)"
                @dragover="onBarDragOver($event, bar.id)"
                @drop="onBarDrop(bar.id)"
                @dragend="onBarDragEnd"
              >
                <svg class="size-4 text-muted-foreground shrink-0 cursor-grab" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg>
                <span class="text-sm font-medium text-foreground flex-1 truncate">{{ bar.name }}</span>
                <span v-if="bar.zug_nr" class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{{ bar.zug_nr }}</span>
                <span class="text-xs text-muted-foreground shrink-0">{{ formatLength(bar.length_cm) }}</span>
                <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="openEditTemplateBar(bar)">
                  <Pencil class="size-3" />
                </Button>
                <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="removeTemplateBar(bar.id, idx)">
                  <X class="size-3" />
                </Button>
              </div>

              <!-- Fixture-Panel -->
              <div class="border-t border-border px-4 py-3 space-y-2">
                <div v-for="fx in (barFixtures[bar.id] ?? [])" :key="fx.id" class="flex items-center gap-2">
                  <span class="text-xs font-mono text-muted-foreground w-16 shrink-0 tabular-nums">{{ cmToDisplay(fx.position) }} {{ unit }}</span>
                  <span class="text-xs text-foreground flex-1 truncate">
                    <span v-if="fx.channel" class="font-semibold mr-1">{{ fx.channel }}</span>
                    <span v-if="fx.device">{{ fx.device }}</span>
                    <span v-if="fx.color" class="ml-1 text-muted-foreground">· {{ fx.color }}</span>
                  </span>
                  <span v-if="fx.notes" class="text-xs text-muted-foreground truncate max-w-24">{{ fx.notes }}</span>
                  <Button variant="ghost" size="icon" class="size-5 text-muted-foreground shrink-0" @click="openEditBarFixture(bar, fx)">
                    <Pencil class="size-2.5" />
                  </Button>
                  <Button variant="ghost" size="icon" class="size-5 text-muted-foreground shrink-0" @click="removeBarFixture(bar, fx.id)">
                    <X class="size-2.5" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" class="border-dashed text-xs" @click="openNewBarFixture(bar)">
                  <Plus class="size-2.5 mr-1" /> {{ t('template.bar.fixture.add_optional') }}
                </Button>
              </div>
            </div>
            <Button variant="outline" size="sm" class="w-full border-dashed" @click="openNewTemplateBar">
              <Plus class="size-3 mr-1.5" /> {{ t('zugstange.add') }}
            </Button>
          </TabsContent>

          <!-- Beleuchtungsgestelle -->
          <TabsContent value="towers" class="mt-0 outline-none space-y-3">
            <div class="flex justify-end">
              <Button variant="outline" size="sm" :disabled="applyingToShows === 'towers'" @click="handleApplyToAllShows('towers')">
                {{ applyingToShows === 'towers' ? '…' : t('template.apply_to_shows.towers') }}
              </Button>
            </div>
            <div class="text-sm text-muted-foreground">{{ t('template.tower.hint') }}</div>
            <div v-if="templateTowers.length === 0" class="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-6 text-center">
              {{ t('template.tower.empty') }}
            </div>
            <div
              v-for="(tower, idx) in templateTowers" :key="tower.id"
              class="rounded-md border bg-card transition-colors"
              :class="towerDragOverId === tower.id ? 'border-primary bg-primary/5' : towerDraggedId === tower.id ? 'opacity-40 border-border' : 'border-border'"
            >
              <!-- Tower-Header -->
              <div
                draggable="true"
                class="flex items-center gap-3 px-4 py-2.5 cursor-grab"
                @dragstart="onTowerDragStart(tower.id)"
                @dragover="onTowerDragOver($event, tower.id)"
                @drop="onTowerDrop(tower.id)"
                @dragend="onTowerDragEnd"
              >
                <svg class="size-4 text-muted-foreground shrink-0 cursor-grab" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg>
                <span class="text-sm font-medium text-foreground flex-1 truncate">{{ tower.name }}</span>
                <span v-if="tower.side" class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{{ tower.side }}</span>
                <span class="text-xs text-muted-foreground shrink-0">{{ tower.slot_count }} Slots</span>
                <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="toggleTowerSlots(tower.id)">
                  <ChevronDown class="size-3 transition-transform" :class="expandedTowerId === tower.id ? 'rotate-180' : ''" />
                </Button>
                <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="openEditTemplateTower(tower)">
                  <Pencil class="size-3" />
                </Button>
                <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="removeTemplateTower(tower.id, idx)">
                  <X class="size-3" />
                </Button>
              </div>

              <!-- Slot-Panel (aufklappbar) -->
              <div v-if="expandedTowerId === tower.id" class="border-t border-border divide-y divide-border/60">
                <div v-for="slot in sortedSlots(tower)" :key="slot.slot_index" class="flex items-center gap-3 px-4 py-2">
                  <span class="w-6 text-xs font-mono text-muted-foreground text-right shrink-0">{{ slot.slot_index }}</span>
                  <span class="text-xs text-foreground flex-1">
                    <span v-if="slot.channel" class="font-semibold mr-1">{{ slot.channel }}</span>
                    <span v-if="slot.device">{{ slot.device }}</span>
                    <span v-if="slot.color" class="ml-1 text-muted-foreground">· {{ slot.color }}</span>
                    <span v-if="!slot.channel && !slot.device" class="text-muted-foreground/60">—</span>
                  </span>
                  <Button variant="ghost" size="icon" class="size-5 text-muted-foreground shrink-0" @click="openEditTowerSlot(tower, slot)">
                    <Pencil class="size-2.5" />
                  </Button>
                  <Button v-if="slot.channel || slot.device" variant="ghost" size="icon" class="size-5 text-muted-foreground shrink-0" @click="clearTowerSlot(tower, slot.slot_index)">
                    <X class="size-2.5" />
                  </Button>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" class="w-full border-dashed" @click="openNewTemplateTower">
              <Plus class="size-3 mr-1.5" /> {{ t('template.tower.add') }}
            </Button>
          </TabsContent>

          <!-- Grundriss-Editor -->
          <TabsContent value="floorplan" class="mt-0 outline-none">
            <div class="h-[calc(100vh-16rem)] rounded-lg border border-border overflow-hidden">
            <FloorplanEditor
              :image-url="floorplanImageUrl"
              :initial-canvas-data="floorplanCanvasData"
              :channels="[]"
              :towers="[]"
              :bars="templateBars"
              @change="onFloorplanChange"
              @upload-image="(f) => onFloorplanImageUpload({ target: { files: [f] } })"
              @delete-image="removeFloorplanImage"
            />
            </div>
            <Alert v-if="floorplanError" variant="destructive" class="mt-2">
              <AlertDescription>{{ floorplanError }}</AlertDescription>
            </Alert>
          </TabsContent>
            </Tabs>
            </template> 
    </template>

    <!-- Vorlagen-Liste -->
    <template v-else>
      <div class="sm:flex sm:items-center mb-8">
        <div class="sm:flex-auto">
          <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.templates') }}</h1>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-2">
          <Button @click="openUpload">
            {{ t('template.upload') }}
          </Button>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-muted-foreground">…</div>
      <div v-else-if="templates.length === 0" class="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p class="text-muted-foreground text-sm">{{ t('template.list.empty') }}</p>
        <Button variant="accent" @click="openUpload" class="flex items-center gap-2">
          <Upload class="size-4" />
          {{ t('template.upload') }}
        </Button>
      </div>

      <ul v-else role="list" class="divide-y divide-border">
        <li v-for="tpl in templates" :key="tpl.name" class="flex items-center justify-between gap-x-6 py-5 cursor-pointer hover:bg-muted/50 -mx-4 px-4 rounded-lg transition-colors" @click="openDetail(tpl.name)">
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-foreground">{{ templateDisplayName(tpl.name) || tpl.name }}</p>
            <div class="flex flex-wrap gap-x-4 mt-1 text-xs text-muted-foreground">
              <span>{{ tpl.channelCount }} {{ tpl.channelCount === 1 ? t('template.channel.singular') : t('template.channel.plural') }}</span>
              <span v-if="tpl.oscHost">OSC: {{ tpl.oscHost }}</span>
              <span v-if="tpl.updatedAt">{{ t('template.updated_at', { date: formatDate(tpl.updatedAt) }) }}</span>
            </div>
          </div>
          <div class="flex flex-none items-center gap-x-4" @click.stop>
            <Button variant="outline" size="sm" @click="openDetail(tpl.name)">
              {{ t('action.edit') }}
            </Button>
            <Button variant="destructive" size="sm" @click="handleDelete(tpl.name)">
              {{ t('action.delete') }}
            </Button>
          </div>
        </li>
      </ul>
    </template>

    <!-- Neu-anlegen-Dialog -->
    <Dialog :open="newDialogOpen" @update:open="val => { if (!val) newDialogOpen = false }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('template.new') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('template.name') }}</Label>
            <Input
              v-model="newTemplateName"
              :placeholder="t('template.new.name.placeholder')"
              autofocus
              autocomplete="off"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              @keydown.enter.prevent="handleCreateTemplate"
            />
            <p v-if="newTemplateError" class="text-xs text-destructive mt-1">{{ newTemplateError }}</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="newDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button :disabled="newTemplateCreating || !newTemplateName.trim()" @click="handleCreateTemplate">
            {{ newTemplateCreating ? '…' : t('template.new.create') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Template-Bar Dialog -->
    <Dialog :open="tbarDialogOpen" @update:open="tbarDialogOpen = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingTbar ? t('zugstange.dialog.edit') : t('zugstange.dialog.new') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('zugstange.field.name') }}</Label>
            <Input size="lg" v-model="tbarForm.name" :placeholder="t('zugstange.name.placeholder')" autofocus />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label>{{ t('zugstange.field.zug_nr') }}</Label>
              <Input size="lg" v-model="tbarForm.zug_nr" :placeholder="t('zugstange.field.zug_nr.placeholder')" />
            </div>
            <div>
              <Label>{{ t('zugstange.field.length') }} ({{ unit }})</Label>
              <Input size="lg" :modelValue="tbarFormDisplay.length" type="number" :min="lengthMin" :max="lengthMax" :step="inputStep" @update:modelValue="tbarForm.length_cm = parseToCm(Number($event))" />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="tbarDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button @click="saveTbarForm">{{ editingTbar ? t('action.save') : t('zugstange.action.create') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Template-Tower Dialog -->
    <Dialog :open="ttowerDialogOpen" @update:open="ttowerDialogOpen = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingTtower ? t('template.tower.edit') : t('template.tower.new') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('gassenturm.field.name') }}</Label>
            <Input size="lg" v-model="ttowerForm.name" :placeholder="t('gassenturm.field.name.placeholder')" autofocus />
          </div>
          <div class="grid grid-cols-1 gap-3">
            <div>
              <Label>{{ t('gassenturm.field.side') }}</Label>
              <Input size="lg" v-model="ttowerForm.side" placeholder="L / R" />
            </div>
          </div>
          <div>
            <Label>{{ t('gassenturm.field.slot_count') }}</Label>
            <Input size="lg" v-model.number="ttowerForm.slot_count" type="number" min="1" max="20" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="ttowerDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button @click="saveTtowerForm">{{ editingTtower ? t('action.save') : t('template.tower.action.create') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Tower-Slot-Edit-Dialog -->
    <Dialog :open="towerSlotDialogOpen" @update:open="towerSlotDialogOpen = $event">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Slot {{ editingTowerSlot?.slot_index }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('template.tower.slot.channel_label') }}</Label>
            <Input size="lg" v-model="towerSlotForm.channel" :placeholder="t('template.fixture.channel.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.tower.slot.device_label') }}</Label>
            <Input size="lg" v-model="towerSlotForm.device" :placeholder="t('template.fixture.device.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.tower.slot.color_label') }}</Label>
            <Input size="lg" v-model="towerSlotForm.color" :placeholder="t('template.fixture.color.placeholder')" />
          </div>
          <p class="text-xs text-muted-foreground">{{ t('template.tower.slot.hint') }}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="towerSlotDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button @click="saveTowerSlot">{{ t('action.save') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Bar-Fixture Dialog -->
    <Dialog :open="barFixtureDialogOpen" @update:open="barFixtureDialogOpen = $event">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ editingBarFixture ? t('template.bar.fixtures') : t('template.bar.fixture.add') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('template.bar.fixture.position') }}</Label>
            <Input size="lg" :modelValue="cmToDisplay(barFixtureForm.position)" type="number" :step="inputStep" @update:modelValue="barFixtureForm.position = parseToCm(Number($event))" />
          </div>
          <div>
            <Label>{{ t('template.bar.fixture.channel') }}</Label>
            <Input size="lg" v-model="barFixtureForm.channel" :placeholder="t('template.fixture.channel.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.bar.fixture.device') }}</Label>
            <Input size="lg" v-model="barFixtureForm.device" :placeholder="t('template.fixture.device.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.bar.fixture.color') }}</Label>
            <Input size="lg" v-model="barFixtureForm.color" :placeholder="t('template.fixture.color.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.bar.fixture.notes') }}</Label>
            <Input size="lg" v-model="barFixtureForm.notes" placeholder="" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="barFixtureDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button @click="saveBarFixture">{{ t('action.save') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Upload-Dialog -->
    <Dialog :open="uploadOpen" @update:open="val => { if (!val) closeUpload() }">
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{{ t('template.upload') }}</DialogTitle>
        </DialogHeader>

        <div v-if="step === 'select'" class="border-2 border-dashed border-border rounded-lg p-8 text-center mt-4" @dragover.prevent @drop.prevent="onDrop">
          <input ref="fileInput" type="file" accept=".csv,.txt" hidden @change="onFileChange" />
          <p class="text-sm text-muted-foreground mb-4">{{ t('template.upload.hint') }}</p>
          <Button @click="fileInput?.click()">{{ t('template.csv.choose') }}</Button>
        </div>

        <div v-else-if="step === 'preview'" class="pt-4 space-y-4">
          <div>
            <Label for="importName" class="text-xs">{{ t('template.name') }}</Label>
            <Input size="lg" id="importName" v-model="importName" type="text" required class="mt-1" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
          </div>
          <div class="text-sm text-muted-foreground">
            <span>{{ t('csv.preview.channels', { count: previewChannels.length }) }}</span>
          </div>
          <div class="overflow-x-auto max-h-96 border border-border rounded-md">
            <Table class="min-w-full text-sm">
              <TableHeader class="sticky top-0 bg-card shadow-sm">
                <TableRow>
                  <TableHead class="w-16">{{ t('field.channel') }}</TableHead>
                  <TableHead class="w-24">{{ t('field.address') }}</TableHead>
                  <TableHead class="w-[30ch]">{{ t('field.device') }}</TableHead>
                  <TableHead class="w-[30ch]">{{ t('field.position') }}</TableHead>
                  <TableHead class="w-24">{{ t('field.color') }}</TableHead>
                  <TableHead>{{ t('field.notes') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="ch in previewChannels.slice(0, 20)" :key="ch.channel">
                  <TableCell>{{ ch.channel }}</TableCell>
                  <TableCell>{{ ch.address }}</TableCell>
                  <TableCell>{{ ch.device }}</TableCell>
                  <TableCell>{{ ch.position }}</TableCell>
                  <TableCell>{{ ch.color }}</TableCell>
                  <TableCell>{{ ch.notes }}</TableCell>
                </TableRow>
                <TableRow v-if="previewChannels.length > 20">
                  <TableCell colspan="6" class="text-center text-muted-foreground">{{ t('template.more_channels', { count: previewChannels.length - 20 }) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <Alert v-if="importError" variant="destructive" class="mt-2">
            <AlertDescription>{{ importError }}</AlertDescription>
          </Alert>
          <DialogFooter class="flex justify-end gap-3 mt-4 sm:justify-end">
            <Button variant="outline" @click="step = 'select'">{{ t('action.back') }}</Button>
            <Button :disabled="importing || !importName.trim()" @click="handleImport">
              {{ importing ? '…' : t('template.upload.confirm') }}
            </Button>
          </DialogFooter>
        </div>

        <div v-else-if="step === 'done'" class="py-8 text-center">
          <p class="text-foreground mb-4">✓ {{ t('template.upload.success') }}</p>
          <Button @click="closeUpload">{{ t('action.close') }}</Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Auf alle Shows anwenden: Vorschau der betroffenen Shows -->
    <Dialog :open="applyDialogOpen" @update:open="applyDialogOpen = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ applyDialogTitle }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p v-if="applyShowsLoading" class="text-sm text-muted-foreground">{{ t('template.apply_to_shows.dialog.loading') }}</p>
          <template v-else>
            <div v-if="applyShows.length">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                {{ t('template.apply_to_shows.dialog.shows', { count: applyShows.length }) }}
              </p>
              <ul class="max-h-48 overflow-y-auto flex flex-col divide-y divide-border/50">
                <li v-for="show in applyShows" :key="show.id" class="py-1.5 text-sm text-foreground truncate">{{ show.name }}</li>
              </ul>
            </div>
            <p v-else class="text-sm text-muted-foreground">{{ t('template.apply_to_shows.dialog.none') }}</p>
            <p class="text-xs text-muted-foreground/70 pt-1">{{ t('template.apply_to_shows.dialog.safe') }}</p>
          </template>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="applyDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button :disabled="applyShowsLoading || applyShows.length === 0 || !!applyingToShows" @click="confirmApplyToAllShows">
            {{ applyingToShows ? '…' : t('action.apply') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Ergebnis der Übertragung -->
    <Dialog :open="applyResultOpen" @update:open="applyResultOpen = $event">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t('template.apply_to_shows.result.title') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p class="text-sm text-muted-foreground">{{ applyResultText }}</p>
        </DialogBody>
        <DialogFooter>
          <Button @click="applyResultOpen = false">{{ t('action.close') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  <!-- FAB -->
  <Button v-if="!editingName" variant="accent" @click="openNewDialog" class="fixed bottom-6 right-6 h-11 px-5 shadow-lg border-0 flex items-center gap-2">
    <Plus class="size-4" /> {{ t('template.new') }}
  </Button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ArrowLeft, Upload, Pencil, Plus, X, ChevronDown } from 'lucide-vue-next'
import { useLocale } from '../composables/useLocale.js'
import { useMeasureUnit } from '../composables/useMeasureUnit'
import { useConfirm } from '../composables/useConfirm.js'
import { fetchTemplates, fetchTemplateChannels, saveTemplate, uploadTemplate, deleteTemplate, saveTemplateOscHost, renameTemplate, applyTemplateToAllShows } from '../api/templates.js'
import { fetchTemplateSections, saveTemplateSections } from '../api/sections.js'
import { fetchShows } from '../api/shows.js'
import { templateDisplayName } from '../utils/templateName.js'
import { uuid } from '../utils/uuid.js'
import ChannelTable from '../components/channel/ChannelTable.vue'
import { fetchTemplateFloorplan, saveTemplateFloorplan, uploadTemplateFloorplanImage, deleteTemplateFloorplanImage } from '../api/floorplan.js'
import FloorplanEditor from '../components/FloorplanEditor.vue'
import { fetchTemplateBars, createTemplateBar, updateTemplateBar, deleteTemplateBar, reorderTemplateBars } from '../api/templateBars.js'
import { fetchTemplateTowers, createTemplateTower, updateTemplateTower, deleteTemplateTower, reorderTemplateTowers, updateTemplateTowerSlot } from '../api/templateTowers.js'
import { api } from '../api/client.js'
import { useDragReorder } from '../composables/useDragReorder'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'

const { t } = useLocale()
const { confirm } = useConfirm()
const { unit, formatLength, cmToDisplay, parseToCm, inputStep, lengthMin, lengthMax } = useMeasureUnit()

const templates = ref([])
const loading = ref(true)
const editingOscHost = ref('')
const oscSaving = ref(false)
const renamingName = ref(false)
const renameValue = ref('')
const renameError = ref('')
const renameSaving = ref(false)
const renameInput = ref(null)

// Neu anlegen
const newDialogOpen = ref(false)
const newTemplateName = ref('')
const newTemplateCreating = ref(false)
const newTemplateError = ref('')

// Upload
const uploadOpen = ref(false)
const fileInput = ref(null)
const step = ref('select')
const csvText = ref('')
const importName = ref('')
const previewChannels = ref([])
const importing = ref(false)
const importError = ref('')

// Detail (inline)
const editingName = ref(null)
const detailChannels = ref([])
const detailLoading = ref(false)
const detailSaving = ref(false)
const activeTab = ref('channels')
const templateSections = ref([])
const sectionsSaving = ref(false)
const floorplanImageUrl = ref(null)
const floorplanCanvasData = ref(null)
const floorplanUploading = ref(false)
const floorplanError = ref('')

// Template-Bars
const templateBars = ref([])
const { draggedId: barDraggedId, dragOverId: barDragOverId, onDragStart: onBarDragStart, onDragOver: onBarDragOver, onDrop: onBarDrop, onDragEnd: onBarDragEnd } = useDragReorder(
  templateBars,
  (ordered) => reorderTemplateBars(editingName.value, ordered.map(b => b.id)).catch(() => {})
)
const tbarDialogOpen = ref(false)
const editingTbar = ref(null)
const tbarForm = ref({ name: '', zug_nr: '', length_cm: 1100 })
const tbarFormDisplay = computed({
  get: () => ({ length: cmToDisplay(tbarForm.value.length_cm) }),
  set: (v) => { tbarForm.value.length_cm = parseToCm(v.length) },
})

const emptySet = new Set()
const applyingToShows = ref('')
// Vorschau vor der Massenoperation: welche Shows hängen an dieser Vorlage?
const applyDialogOpen = ref(false)
const applyScope = ref('')
const applyShows = ref([])
const applyShowsLoading = ref(false)
const applyResultOpen = ref(false)
const applyResultText = ref('')
const applyDialogTitle = computed(() =>
  applyScope.value ? t(`template.apply_to_shows.${applyScope.value}.confirm`, { name: editingName.value }) : ''
)

// Template-Towers
const templateTowers = ref([])
const { draggedId: towerDraggedId, dragOverId: towerDragOverId, onDragStart: onTowerDragStart, onDragOver: onTowerDragOver, onDrop: onTowerDrop, onDragEnd: onTowerDragEnd } = useDragReorder(
  templateTowers,
  (ordered) => reorderTemplateTowers(editingName.value, ordered.map(t => t.id)).catch(() => {})
)
const ttowerDialogOpen = ref(false)
const editingTtower = ref(null)
const ttowerForm = ref({ name: '', side: '', stage_area: '', slot_count: 4 })
const expandedTowerId = ref(null)

const towerSlotDialogOpen = ref(false)
const editingTowerSlot = ref(null)
const editingTowerSlotTower = ref(null)
const towerSlotForm = ref({ channel: '', device: '', color: '' })

// Bar-Fixtures
const barFixtures = ref({})
const barFixtureDialogOpen = ref(false)
const editingBarFixture = ref(null)
const editingBarFixtureBar = ref(null)
const barFixtureForm = ref({ position: 0, channel: '', device: '', color: '', notes: '' })

const groupedChannels = computed(() => {
  const sorted = [...detailChannels.value].sort((a, b) => Number(a.channel) - Number(b.channel))
  const map = new Map()
  for (const ch of sorted) {
    const pos = ch.position || ''
    if (!map.has(pos)) map.set(pos, [])
    map.get(pos).push(ch)
  }
  return [...map.entries()].map(([position, channels]) => ({ position, channels }))
})

onMounted(async () => {
  templates.value = await fetchTemplates()
  loading.value = false
})

// ── Neu anlegen ─────────────────────────────────────────────────────────────

function openNewDialog() {
  newTemplateName.value = ''
  newTemplateError.value = ''
  newDialogOpen.value = true
}

async function handleCreateTemplate() {
  const name = newTemplateName.value.trim()
  if (!name) return
  if (templates.value.some(tpl => tpl.name === name)) {
    newTemplateError.value = t('template.new.error.duplicate')
    return
  }
  newTemplateCreating.value = true
  newTemplateError.value = ''
  try {
    await saveTemplate(name, [])
    templates.value = await fetchTemplates()
    newDialogOpen.value = false
    await openDetail(name)
  } catch (e) {
    newTemplateError.value = e?.message || t('template.upload.error')
  } finally {
    newTemplateCreating.value = false
  }
}

// ── Upload ──────────────────────────────────────────────────────────────────

function openUpload() {
  step.value = 'select'
  csvText.value = ''
  importName.value = ''
  previewChannels.value = []
  importError.value = ''
  uploadOpen.value = true
}

function closeUpload() {
  uploadOpen.value = false
  step.value = 'select'
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) processFile(file)
}

function onDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file) processFile(file)
}

function processFile(file) {
  importName.value = file.name.replace(/\.csv$/i, '')
  const reader = new FileReader()
  reader.onload = (e) => {
    csvText.value = e.target.result
    const lines = csvText.value.trim().split('\n').filter(Boolean)
    const headerIdx = lines.findIndex(l => l.startsWith('channel'))
    if (headerIdx !== -1) {
      const headers = lines[headerIdx].split(';').map(h => h.trim())
      previewChannels.value = lines.slice(headerIdx + 1).map(line => {
        const vals = line.split(';')
        return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
      })
    }
    step.value = 'preview'
  }
  reader.readAsText(file, 'utf-8')
}

async function handleImport() {
  importing.value = true
  importError.value = ''
  try {
    const name = importName.value.trim().replace(/\.csv$/i, '')
    await uploadTemplate({ name, text: csvText.value })
    templates.value = await fetchTemplates()
    step.value = 'done'
  } catch (e) {
    importError.value = e?.message || t('template.upload.error')
  } finally {
    importing.value = false
  }
}

// ── Detail ──────────────────────────────────────────────────────────────────

async function openDetail(name) {
  editingName.value = name
  detailLoading.value = true
  activeTab.value = 'channels'
  const tpl = templates.value.find(t => t.name === name)
  editingOscHost.value = tpl?.oscHost ?? ''
  const [channels, sections, bars, towers] = await Promise.all([
    fetchTemplateChannels(name),
    fetchTemplateSections(name),
    fetchTemplateBars(name),
    fetchTemplateTowers(name),
  ])
  detailChannels.value = channels
  templateSections.value = Array.isArray(sections) ? sections : (sections?.sections ?? [])
  templateBars.value = bars
  templateTowers.value = towers
  barFixtures.value = {}
  expandedTowerId.value = null
  detailLoading.value = false
  await Promise.all(bars.map(loadBarFixtures))
}

function openNewTemplateBar() {
  editingTbar.value = null
  tbarForm.value = { name: '', zug_nr: '', length_cm: 1100 }
  tbarDialogOpen.value = true
}
function openEditTemplateBar(bar) {
  editingTbar.value = bar
  tbarForm.value = { name: bar.name, zug_nr: bar.zug_nr, length_cm: bar.length_cm }
  tbarDialogOpen.value = true
}
async function saveTbarForm() {
  if (!tbarForm.value.name) return
  if (editingTbar.value) {
    await updateTemplateBar(editingName.value, editingTbar.value.id, tbarForm.value)
    Object.assign(editingTbar.value, tbarForm.value)
  } else {
    const { id } = await createTemplateBar(editingName.value, tbarForm.value)
    const bar = { id, template_id: '', sort_order: templateBars.value.length, ...tbarForm.value }
    templateBars.value.push(bar)
    await loadBarFixtures(bar)
  }
  tbarDialogOpen.value = false
}
async function removeTemplateBar(barId, idx) {
  await deleteTemplateBar(editingName.value, barId)
  templateBars.value.splice(idx, 1)
  delete barFixtures.value[barId]
}

// ── Bar-Fixture-Funktionen ────────────────────────────────────────────────────

async function loadBarFixtures(bar) {
  const fixtures = await api.get(`/api/templates/${encodeURIComponent(editingName.value)}/bars/${bar.id}/fixtures`)
  barFixtures.value[bar.id] = fixtures
}

function openNewBarFixture(bar) {
  editingBarFixture.value = null
  editingBarFixtureBar.value = bar
  barFixtureForm.value = { position: 0, channel: '', device: '', color: '', notes: '' }
  barFixtureDialogOpen.value = true
}

function openEditBarFixture(bar, fx) {
  editingBarFixture.value = fx
  editingBarFixtureBar.value = bar
  barFixtureForm.value = { position: fx.position, channel: fx.channel ?? '', device: fx.device ?? '', color: fx.color ?? '', notes: fx.notes ?? '' }
  barFixtureDialogOpen.value = true
}

async function saveBarFixture() {
  const bar = editingBarFixtureBar.value
  if (!bar) return
  const data = {
    position: barFixtureForm.value.position,
    channel: barFixtureForm.value.channel || null,
    device: barFixtureForm.value.device || null,
    color: barFixtureForm.value.color || null,
    notes: barFixtureForm.value.notes || '',
  }
  if (editingBarFixture.value) {
    await api.put(`/api/templates/${encodeURIComponent(editingName.value)}/bars/${bar.id}/fixtures/${editingBarFixture.value.id}`, data)
    Object.assign(editingBarFixture.value, data)
  } else {
    const { id } = await api.post(`/api/templates/${encodeURIComponent(editingName.value)}/bars/${bar.id}/fixtures`, data)
    if (!barFixtures.value[bar.id]) barFixtures.value[bar.id] = []
    barFixtures.value[bar.id].push({ id, bar_id: bar.id, ...data })
    barFixtures.value[bar.id].sort((a, b) => a.position - b.position)
  }
  barFixtureDialogOpen.value = false
}

async function removeBarFixture(bar, fixtureId) {
  await api.delete(`/api/templates/${encodeURIComponent(editingName.value)}/bars/${bar.id}/fixtures/${fixtureId}`)
  if (barFixtures.value[bar.id]) {
    barFixtures.value[bar.id] = barFixtures.value[bar.id].filter(fx => fx.id !== fixtureId)
  }
}

// ── Template-Tower-Funktionen ─────────────────────────────────────────────────

function sortedSlots(tower) {
  return [...(tower.slots ?? [])].sort((a, b) => a.slot_index - b.slot_index)
}

function toggleTowerSlots(towerId) {
  expandedTowerId.value = expandedTowerId.value === towerId ? null : towerId
}

function openNewTemplateTower() {
  editingTtower.value = null
  ttowerForm.value = { name: '', side: '', stage_area: '', slot_count: 4 }
  ttowerDialogOpen.value = true
}

function openEditTemplateTower(tower) {
  editingTtower.value = tower
  ttowerForm.value = { name: tower.name, side: tower.side, stage_area: tower.stage_area, slot_count: tower.slot_count }
  ttowerDialogOpen.value = true
}

async function saveTtowerForm() {
  if (!ttowerForm.value.name) return
  if (editingTtower.value) {
    await updateTemplateTower(editingName.value, editingTtower.value.id, ttowerForm.value)
    Object.assign(editingTtower.value, ttowerForm.value)
    // Slots anpassen
    const tower = editingTtower.value
    const existing = tower.slots ?? []
    const newCount = ttowerForm.value.slot_count
    if (newCount > existing.length) {
      for (let i = existing.length + 1; i <= newCount; i++) {
        tower.slots.push({ id: '', tower_id: tower.id, slot_index: i, channel: null, device: null, color: null })
      }
    } else if (newCount < existing.length) {
      tower.slots = tower.slots.filter(s => s.slot_index <= newCount)
    }
  } else {
    const { id } = await createTemplateTower(editingName.value, ttowerForm.value)
    const slots = []
    for (let i = 1; i <= ttowerForm.value.slot_count; i++) {
      slots.push({ id: '', tower_id: id, slot_index: i, channel: null, device: null, color: null })
    }
    templateTowers.value.push({ id, template_id: '', sort_order: templateTowers.value.length, slots, ...ttowerForm.value })
  }
  ttowerDialogOpen.value = false
}

async function removeTemplateTower(towerId, idx) {
  await deleteTemplateTower(editingName.value, towerId)
  templateTowers.value.splice(idx, 1)
}

function openEditTowerSlot(tower, slot) {
  editingTowerSlotTower.value = tower
  editingTowerSlot.value = slot
  towerSlotForm.value = { channel: slot.channel ?? '', device: slot.device ?? '', color: slot.color ?? '' }
  towerSlotDialogOpen.value = true
}

async function saveTowerSlot() {
  const tower = editingTowerSlotTower.value
  const slot = editingTowerSlot.value
  if (!tower || !slot) return
  const data = {
    channel: towerSlotForm.value.channel || null,
    device: towerSlotForm.value.device || null,
    color: towerSlotForm.value.color || null,
  }
  await updateTemplateTowerSlot(editingName.value, tower.id, slot.slot_index, data)
  Object.assign(slot, data)
  towerSlotDialogOpen.value = false
}

async function clearTowerSlot(tower, slotIndex) {
  await updateTemplateTowerSlot(editingName.value, tower.id, slotIndex, { channel: null, device: null, color: null })
  const slot = (tower.slots ?? []).find(s => s.slot_index === slotIndex)
  if (slot) { slot.channel = null; slot.device = null; slot.color = null }
}

async function persistOscHost() {
  oscSaving.value = true
  await saveTemplateOscHost(editingName.value, editingOscHost.value)
  const tpl = templates.value.find(t => t.name === editingName.value)
  if (tpl) tpl.oscHost = editingOscHost.value
  oscSaving.value = false
}

function fixCapitalization(e) {
  const el = e.target
  const pos = el.selectionStart
  const val = el.value
  // WebKit kapitalisiert nach Umlauten/ß — wir vergleichen mit renameValue
  // und korrigieren falls der neue Buchstabe unerwartet groß ist
  if (val === renameValue.value) return
  const prev = renameValue.value
  if (pos > 0 && pos <= val.length) {
    const newChar = val[pos - 1]
    const prevChar = prev[pos - 2] ?? ''
    const umlautOrSz = /[äöüßÄÖÜ]/.test(prevChar)
    if (umlautOrSz && newChar !== newChar.toLowerCase()) {
      const fixed = val.slice(0, pos - 1) + newChar.toLowerCase() + val.slice(pos)
      renameValue.value = fixed
      nextTick(() => {
        el.setSelectionRange(pos, pos)
      })
    }
  }
}

function startRename() {
  renameValue.value = editingName.value
  renameError.value = ''
  renamingName.value = true
}

async function commitRename() {
  const newName = renameValue.value.trim()
  if (!newName || newName === editingName.value) { renamingName.value = false; return }
  renameSaving.value = true
  renameError.value = ''
  try {
    await renameTemplate(editingName.value, newName)
    const tpl = templates.value.find(t => t.name === editingName.value)
    if (tpl) tpl.name = newName
    editingName.value = newName
    renamingName.value = false
  } catch (e) {
    renameError.value = e?.message?.includes('409') || e?.status === 409
      ? t('template.rename.error')
      : (e?.message || t('template.rename.error'))
  } finally {
    renameSaving.value = false
  }
}

watch(editingName, () => {
  loadFloorplan()
}, { immediate: true })

async function persist() {
  detailSaving.value = true
  await saveTemplate(editingName.value, detailChannels.value)
  detailSaving.value = false
}

async function loadFloorplan() {
  if (!editingName.value) return
  const data = await fetchTemplateFloorplan(editingName.value).catch(() => null)
  floorplanImageUrl.value = data?.image_url ? api.url(data.image_url) + '&t=' + Date.now() : null
  floorplanCanvasData.value = data?.canvas_data ?? null
}

function onFloorplanChange(canvasData) {
  floorplanCanvasData.value = canvasData
  saveTemplateFloorplan(editingName.value, canvasData).catch(() => {})
}

async function onFloorplanImageUpload(e) {
  const file = e.target.files[0]
  if (!file || floorplanUploading.value) return
  floorplanUploading.value = true
  floorplanError.value = ''
  try {
    const result = await uploadTemplateFloorplanImage(editingName.value, file)
    floorplanImageUrl.value = result.image_url ? api.url(result.image_url) : null
    e.target.value = ''
  } catch (err) {
    floorplanError.value = err?.message || 'Upload fehlgeschlagen'
  } finally {
    floorplanUploading.value = false
  }
}

async function removeFloorplanImage() {
  floorplanError.value = ''
  try {
    await deleteTemplateFloorplanImage(editingName.value)
    floorplanImageUrl.value = null
  } catch (err) {
    floorplanError.value = err?.message || 'Löschen fehlgeschlagen'
  }
}

async function persistSections() {
  sectionsSaving.value = true
  await saveTemplateSections(editingName.value, templateSections.value)
  sectionsSaving.value = false
}

async function deleteChannel(ch) {
  detailChannels.value = detailChannels.value.filter(c => c.channel !== ch.channel)
  await persist()
}

async function clearChannel(ch) {
  ch.notes = ''
  ch.color = ''
  await persist()
}

// ── Sections ────────────────────────────────────────────────────────────────

function addSection() {
  templateSections.value.push({ id: uuid(), title: '', type: 'markdown', order: templateSections.value.length, rows: [] })
  persistSections()
}

function deleteSection(idx) {
  templateSections.value.splice(idx, 1)
  templateSections.value.forEach((s, i) => s.order = i)
  persistSections()
}

function moveSection(idx, dir) {
  const arr = templateSections.value
  const swap = idx + dir
  if (swap < 0 || swap >= arr.length) return
  ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
  arr.forEach((s, i) => s.order = i)
  persistSections()
}

function addField(section) {
  if (!section.rows) section.rows = []
  section.rows.push({ key: uuid().slice(0, 8), label: '', value: '' })
  persistSections()
}

function deleteField(section, idx) {
  const arr = section.rows ?? section.fields
  arr?.splice(idx, 1)
  persistSections()
}

function hasKvTableType() {
  return templateSections.value.some(s => s.type === 'kv-table' || s.type === 'fields')
}

function onTypeChange(section, newType) {
  if (newType === 'kv-table' && hasKvTableType() && section.type !== 'kv-table' && section.type !== 'fields') return
  section.type = newType
  if (newType === 'kv-table' && !section.rows) section.rows = []
  persistSections()
}

// ── Auf alle Shows anwenden ─────────────────────────────────────────────────

// Öffnet die Vorschau. Die betroffenen Shows sind die, deren template-Feld auf
// diese Vorlage zeigt. Deckt sich mit der Server-Bedingung beim Übertragen
// (template = ? AND archived = 0) — /api/shows liefert ohnehin nur unarchivierte.
async function handleApplyToAllShows(scope) {
  applyScope.value = scope
  applyShows.value = []
  applyShowsLoading.value = true
  applyDialogOpen.value = true
  try {
    const shows = await fetchShows()
    applyShows.value = shows.filter(s => s.template === editingName.value)
  } catch {
    applyShows.value = []
  } finally {
    applyShowsLoading.value = false
  }
}

async function confirmApplyToAllShows() {
  const scope = applyScope.value
  applyingToShows.value = scope
  try {
    const result = await applyTemplateToAllShows(editingName.value, scope)
    applyResultText.value = t(`template.apply_to_shows.${scope}.result`, {
      shows: result.shows,
      bars: result.barsAdded,
      towers: result.towersAdded,
      sections: result.sectionsAdded,
    })
    applyDialogOpen.value = false
    applyResultOpen.value = true
  } finally {
    applyingToShows.value = ''
  }
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts))
}

// ── Löschen ─────────────────────────────────────────────────────────────────

async function handleDelete(name) {
  const ok = await confirm({ t, titleKey: 'template.delete.confirm', titleParams: { name }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  await deleteTemplate(name)
  templates.value = templates.value.filter(t => t.name !== name)
}
</script>

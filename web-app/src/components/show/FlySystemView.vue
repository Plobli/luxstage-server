<template>
  <div class="relative flex flex-col h-full overflow-hidden">
    <!-- Typ-Filter -->
    <div v-if="battens.length > 0" class="flex items-center gap-1.5 px-5 pt-3 pb-1 shrink-0 overflow-x-auto">
      <button
        v-for="opt in typeFilterOptions"
        :key="opt.value"
        class="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors"
        :class="typeFilter === opt.value ? 'bg-accent/25 border-accent/60 text-foreground' : 'border-border/40 text-muted-foreground hover:bg-foreground/8'"
        @click="typeFilter = opt.value"
      >{{ opt.label }}<span v-if="opt.value !== 'all'" class="ml-1 tabular-nums opacity-60">{{ opt.count }}</span></button>
    </div>

    <!-- FlySystem-Liste -->
    <div class="flex-1 overflow-y-auto pb-14 md:pb-0">
      <div v-if="battens.length > 0" class="flex justify-end px-4 pt-3">
        <Button variant="ghost" size="sm" class="text-muted-foreground hover:text-destructive" @click="confirmDeleteAllBattens">
          <Trash2 class="size-3.5 mr-1.5" /> {{ t('batten.delete_all') }}
        </Button>
      </div>
      <div v-if="battens.length === 0" class="flex flex-col items-center justify-center gap-3 h-full text-center px-8 -mt-5">
        <AlignJustify class="size-8 text-muted-foreground/70" />
        <div class="max-w-150">
          <p class="text-base font-medium text-foreground/70">{{ t('batten.empty') }}</p>
          <p class="text-sm text-muted-foreground mt-1">{{ t('batten.empty.desc') }}</p>
        </div>
        <Button variant="accent" @click="openNewBattenDialog" class="mt-1 h-11 px-5 rounded-full shadow-lg flex items-center gap-2">
          <Plus class="size-4" /> {{ t('batten.new') }}
        </Button>
      </div>
      <div v-else-if="filteredBattens.length === 0" class="flex flex-col items-center justify-center gap-3 h-full text-center px-8 -mt-5">
        <AlignJustify class="size-8 text-muted-foreground/70" />
        <p class="text-sm text-muted-foreground">{{ t('batten.empty') }}</p>
      </div>

      <!-- Eine Zeile pro Element -->
      <div
        v-for="batten in filteredBattens"
        :key="batten.id"
        draggable="true"
        class="group/row relative flex items-center gap-6 px-5 py-4 mx-3 my-2 rounded-xl border transition-colors"
        :class="dragOverId === batten.id ? 'bg-foreground/10 border-primary/50' : draggedId === batten.id ? 'opacity-40 border-border/40 bg-foreground/6' : 'bg-foreground/6 border-border/40 hover:bg-foreground/8'"
        @dragstart="onBattenDragStart(batten.id)"
        @dragover="onBattenDragOver($event, batten.id)"
        @drop="onBattenDrop(batten.id)"
        @dragend="onBattenDragEnd"
      >
        <!-- Linke Spalte: Name oben, Länge + Höhe unten (bündig zur Anmerkung) -->
        <div class="w-44 shrink-0 self-stretch flex flex-col" :class="isPointBatten(batten) ? 'justify-center' : 'justify-end'">
          <div class="flex items-center gap-1.5 mb-3">
            <span class="text-lg font-semibold text-foreground tracking-tight truncate leading-tight">{{ batten.name }}</span>
          </div>
          <span class="self-start -mt-2 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-foreground/10 text-muted-foreground/70" :class="isPointBatten(batten) ? '' : 'mb-2'">{{ typeLabel(batten.batten_type) }}</span>
          <div v-if="!isPointBatten(batten)" class="min-w-0">
            <!-- Länge -->
            <div class="relative w-32">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider pointer-events-none">{{ t('batten.field.length') }}</span>
              <input
                type="text"
                inputmode="decimal"
                :value="cmToDisplay(batten.length_cm)"
                class="w-full h-8 rounded-md border border-transparent bg-foreground/5 pl-13 pr-7 text-sm tabular-nums text-right text-foreground placeholder:text-muted-foreground/50 hover:bg-foreground/8 focus:outline-none focus:border-accent/60 focus:bg-foreground/8 transition-colors"
                @change="saveInlineField(batten, 'length_cm', parseToCm(parseDecimal($event.target.value)))"
              />
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/70 pointer-events-none">{{ unit }}</span>
            </div>
            <!-- Höhe -->
            <div class="relative mt-1.5 w-32">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider pointer-events-none">{{ t('batten.field.height') }}</span>
              <input
                type="text"
                inputmode="decimal"
                :value="batten.height_cm != null ? cmToDisplay(batten.height_cm) : ''"
                placeholder="—"
                class="w-full h-8 rounded-md border border-transparent bg-foreground/5 pl-13 pr-7 text-sm tabular-nums text-right text-foreground placeholder:text-muted-foreground/50 hover:bg-foreground/8 focus:outline-none focus:border-accent/60 focus:bg-foreground/8 transition-colors"
                @change="saveInlineField(batten, 'height_cm', $event.target.value === '' ? null : parseToCm(parseDecimal($event.target.value)))"
              />
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/70 pointer-events-none">{{ unit }}</span>
            </div>
          </div>
        </div>

        <!-- Mittlere Spalte: Batten-Visualisierung (PointBatten-Kreis oder Stangen-/Traversen-Linie) -->
        <BattenVisualization
          :batten="batten"
          :channels="channels"
          @editFixture="fx => openFixtureEditDialog(fx, batten)"
          @removeFixture="fx => confirmRemoveFixture(fx, batten)"
          @pointBattenAddClick="onPointBattenAddClick(batten)"
          @savePointBattenPositionText="value => savePointBattenPositionText(batten, value)"
          @saveInlineField="(field, value) => saveInlineField(batten, field, value)"
          @lineClick="({ position, side }) => onBattenPositionPick(batten, position, side)"
          @fixtureDragEnd="fx => onFixtureDragEnd(batten, fx)"
        />

        <!-- Rechte Spalte: Aktionen (gestapelt, nur bei Hover) -->
        <div class="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <!-- Als Vorlage speichern -->
          <Button
            v-if="props.saveToTemplateFn"
            variant="ghost" size="icon" class="size-7 text-muted-foreground/60"
            :title="savingBattenId === batten.id ? '…' : t('batten.save_to_template')"
            @click.stop="openSaveDialog(batten)"
          >
            <Loader2 v-if="savingBattenId === batten.id" class="size-3.5 animate-spin" />
            <BookmarkPlus v-else class="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/60" @click="openEditBattenDialog(batten)">
            <Pencil class="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/60" @click="confirmDeleteBatten(batten)">
            <Trash2 class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Neue Batten -->
    <Button v-if="battens.length > 0" variant="accent" @click="openNewBattenDialog" class="absolute bottom-20 right-6 md:bottom-6 h-11 px-5 rounded-full shadow-lg flex items-center gap-2">
      <Plus class="size-4" /> {{ t('batten.new') }}
    </Button>
  </div>

  <!-- Batten Dialog -->
  <Dialog :open="battenDialogOpen" @update:open="battenDialogOpen = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editingBatten ? t('batten.dialog.edit') : t('batten.dialog.new') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('batten.field.type') }}</label>
          <div class="flex gap-1.5">
            <button
              v-for="opt in battenTypeOptions"
              :key="opt.value"
              type="button"
              class="flex-1 h-9 rounded-md border text-sm font-medium transition-colors"
              :class="battenForm.batten_type === opt.value ? 'bg-accent/25 border-accent/60 text-foreground' : 'border-border/40 text-muted-foreground hover:bg-foreground/8'"
              @click="battenForm.batten_type = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('batten.field.name') }}</label>
          <Input size="lg" v-model="battenForm.name" :placeholder="t('batten.name.placeholder')" autofocus />
        </div>
        <div v-if="battenForm.batten_type !== 'point_batten'" class="flex flex-col gap-1.5">
          <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
            {{ t('batten.field.length_unit', { unit }) }}
            <HelpIcon :text="t('batten.field.length.help')" side="right" />
          </label>
          <Input size="lg" :modelValue="battenFormDisplay.length" type="number" :min="lengthMin" :max="lengthMax" :step="inputStep" @update:modelValue="battenForm.length_cm = parseToCm(Number($event))" />
        </div>
        <button v-if="battenForm.batten_type !== 'point_batten'" type="button" class="flex items-center justify-between w-full rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40" @click="battenForm.hide_scale = !battenForm.hide_scale">
          <span class="flex items-center gap-1.5 text-sm text-foreground">
            {{ t('batten.scale.hide') }}
            <HelpIcon :text="t('batten.scale.help')" side="right" />
          </span>
          <div class="relative shrink-0 w-9 h-5 rounded-full transition-colors" :class="battenForm.hide_scale ? 'bg-accent' : 'bg-muted'">
            <div class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform" :class="battenForm.hide_scale ? 'translate-x-4' : 'translate-x-0'" />
          </div>
        </button>
        <div v-if="battenForm.batten_type !== 'point_batten' && !battenForm.hide_scale" class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('batten.scale.origin') }}</label>
          <div class="flex gap-1.5">
            <button
              v-for="opt in scaleOriginOptions"
              :key="opt.value"
              type="button"
              class="flex-1 h-9 rounded-md border text-sm font-medium transition-colors"
              :class="battenForm.scale_origin === opt.value ? 'bg-accent/25 border-accent/60 text-foreground' : 'border-border/40 text-muted-foreground hover:bg-foreground/8'"
              @click="battenForm.scale_origin = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button v-if="!editingBatten && props.fromTemplateFn" variant="ghost" class="mr-auto text-xs text-muted-foreground" @click="battenDialogOpen = false; props.fromTemplateFn()">
          {{ t('batten.dialog.from_template') }}
        </Button>
        <Button variant="ghost" @click="battenDialogOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="saveBattenForm">{{ editingBatten ? t('action.save') : t('batten.action.create') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Remove Confirm Dialog -->
  <Dialog :open="removeConfirmOpen" @update:open="removeConfirmOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('batten.fixture.remove.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p class="text-sm text-muted-foreground">{{ removeConfirmText }}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="removeConfirmOpen = false">{{ t('action.cancel') }}</Button>
        <Button variant="destructive" @click="doRemoveFixture">{{ t('batten.fixture.remove.action') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Edit Dialog -->
  <Dialog :open="fixtureEditOpen" @update:open="fixtureEditOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle v-if="fixtureEditFx?.channel_id">Kanal {{ channelNr(fixtureEditFx?.channel_id) }}{{ channelDevice(fixtureEditFx?.channel_id) ? ' · ' + channelDevice(fixtureEditFx?.channel_id) : '' }} — {{ fixtureEditBatten?.name }}</DialogTitle>
        <DialogTitle v-else>{{ t('batten.fixture.generic.title') }} — {{ fixtureEditBatten?.name }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div v-if="!fixtureEditFx?.channel_id" class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('batten.fixture.generic.label') }}</label>
          <Input size="lg" v-model="fixtureEditLabel" :placeholder="t('batten.fixture.generic.label.placeholder')" autofocus @keydown.enter="saveFixtureEdit" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('batten.fixture.notes.label') }}</label>
          <Input size="lg" v-model="fixtureEditNotes" :placeholder="t('batten.fixture.notes.placeholder')" :autofocus="!!fixtureEditFx?.channel_id" @keydown.enter="saveFixtureEdit" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button v-if="fixtureEditFx?.channel_id" variant="ghost" class="mr-auto text-xs text-muted-foreground" @click="goToChannel(fixtureEditFx?.channel_id); fixtureEditOpen = false">{{ t('batten.fixture.channel_link') }}</Button>
        <Button variant="ghost" @click="fixtureEditOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="saveFixtureEdit">{{ t('action.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Picker -->
  <Dialog :open="fixturePickerOpen" @update:open="fixturePickerOpen = $event">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t('batten.fixture.add') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div v-if="pickerMode === 'list'" class="flex flex-col gap-2">
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-accent/50 hover:bg-accent/5 transition-colors self-start"
            @click="pickerMode = 'generic'"
          >
            <Plus class="size-4" /> {{ t('batten.fixture.generic.add') }}
          </button>
          <ChannelPickerGrid
            :channels="channels"
            :model-value="[]"
            :search-placeholder="t('batten.fixture.search.placeholder')"
            :notes-filter="true"
            @pick="ch => { pickerChannel = ch; pickerMode = 'channel' }"
            @enter="ch => { pickerChannel = ch; pickerMode = 'channel'; confirmAddFixture() }"
          />
        </div>
        <div v-if="pickerMode === 'channel'" class="flex flex-col gap-6">
          <button
            type="button"
            class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
            @click="pickerChannel = null; pickerMode = 'list'"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            {{ t('batten.fixture.picker.back') }}
          </button>
          <div class="flex items-center gap-4 px-4 py-3 rounded-lg bg-accent/10 border border-accent/30">
            <span class="text-2xl font-bold tabular-nums w-10 shrink-0 text-accent">{{ pickerChannel.channel }}</span>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-sm font-semibold text-foreground truncate">{{ pickerChannel.device }}</span>
              <span v-if="pickerChannel.address || pickerChannel.color" class="text-xs text-muted-foreground mt-0.5">
                <span v-if="pickerChannel.address">DMX {{ pickerChannel.address }}</span><span v-if="pickerChannel.address && pickerChannel.color"> · </span><span v-if="pickerChannel.color">{{ pickerChannel.color }}</span>
              </span>
            </div>
          </div>
          <div v-if="!isPointBatten(pickerBatten)" class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">{{ t('batten.fixture.position') }} {{ unitLabel }}</label>
            <Input size="lg" autofocus :modelValue="cmToDisplay(pickerPosition)" type="number" :min="cmToDisplay(-(pickerBatten?.length_cm || 600)/2)" :max="cmToDisplay((pickerBatten?.length_cm || 600)/2)" :step="inputStep" @update:modelValue="pickerPosition = parseToCm(Number($event))" @keydown.enter="confirmAddFixture" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">{{ t('batten.fixture.notes.label') }}</label>
            <Input size="lg" v-model="pickerNotes" :placeholder="t('batten.fixture.notes.placeholder')" @keydown.enter="confirmAddFixture" />
          </div>
        </div>
        <div v-if="pickerMode === 'generic'" class="flex flex-col gap-6">
          <button
            type="button"
            class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
            @click="pickerMode = 'list'"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            {{ t('batten.fixture.picker.back') }}
          </button>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">{{ t('batten.fixture.generic.label') }}</label>
            <Input size="lg" v-model="pickerLabel" :placeholder="t('batten.fixture.generic.label.placeholder')" autofocus @keydown.enter="confirmAddFixture" />
          </div>
          <div v-if="!isPointBatten(pickerBatten)" class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">{{ t('batten.fixture.position') }} {{ unitLabel }}</label>
            <Input size="lg" :modelValue="cmToDisplay(pickerPosition)" type="number" :min="cmToDisplay(-(pickerBatten?.length_cm || 600)/2)" :max="cmToDisplay((pickerBatten?.length_cm || 600)/2)" :step="inputStep" @update:modelValue="pickerPosition = parseToCm(Number($event))" @keydown.enter="confirmAddFixture" />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="fixturePickerOpen = false">{{ t('action.cancel') }}</Button>
        <Button :disabled="pickerMode === 'channel' ? !pickerChannel : pickerMode === 'generic' ? !pickerLabel.trim() : true" @click="confirmAddFixture">{{ t('action.add') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Als Vorlage speichern Dialog -->
  <Dialog :open="saveDialogOpen" @update:open="saveDialogOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('batten.save_dialog.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <!-- Ziel + Item-Info -->
        <div class="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5">
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-muted-foreground shrink-0">{{ t('batten.save_dialog.template_label') }}</span>
            <span class="text-sm font-medium text-foreground truncate">{{ props.templateName }}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-muted-foreground shrink-0">{{ t('batten.save_dialog.length_label') }}</span>
            <span class="text-xs text-muted-foreground">{{ formatLength(saveDialogBatten?.length_cm) }}</span>
          </div>
        </div>
        <div>
          <Label class="text-xs text-muted-foreground">{{ t('batten.save_dialog.name_label') }}</Label>
          <Input size="lg" v-model="saveName" autofocus />
        </div>
        <!-- Überschreiben-Warnung -->
        <div v-if="saveNameConflict" class="rounded-lg border border-destructive/50 bg-destructive/5 px-3.5 py-3 space-y-2">
          <p class="text-sm font-medium text-foreground">{{ t('batten.save_dialog.conflict', { name: saveName }) }}</p>
          <p class="text-xs text-muted-foreground">{{ t('batten.save_dialog.conflict.hint') }}</p>
          <div class="flex gap-2 pt-1">
            <Button size="sm" variant="ghost" @click="saveNameConflict = false">{{ t('action.cancel') }}</Button>
            <Button size="sm" variant="destructive" @click="saveConfirmOverwrite = true; confirmSaveDialog()">{{ t('batten.save_dialog.overwrite') }}</Button>
          </div>
        </div>
        <!-- Was wird gespeichert -->
        <div class="space-y-1">
          <!-- Struktur — immer aktiv -->
          <div class="flex items-start gap-3 py-2 opacity-60">
            <Checkbox :model-value="true" disabled class="mt-0.5" />
            <div>
              <p class="text-sm font-medium text-foreground">{{ t('batten.save_dialog.structure') }}</p>
              <p class="text-xs text-muted-foreground">{{ t('batten.save_dialog.structure.desc') }}</p>
            </div>
          </div>
          <!-- Scheinwerfer-Trennlinie -->
          <div v-if="saveDialogBatten?.fixtures?.length" class="pt-1">
            <p class="text-xs font-semibold text-muted-foreground px-1 pb-1">
              {{ t('batten.save_dialog.fixtures_count', { count: saveDialogBatten.fixtures.length }) }}
            </p>
            <div class="h-px bg-border/50 mx-1 mb-1" />
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.position" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('batten.save_dialog.field.position') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('batten.save_dialog.field.position.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.channel" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('batten.save_dialog.field.channel') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('batten.save_dialog.field.channel.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.device" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('batten.save_dialog.field.device') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('batten.save_dialog.field.device.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.notes" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('batten.save_dialog.field.notes') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('batten.save_dialog.field.notes.desc') }}</p>
              </div>
            </label>
          </div>
          <p v-else class="text-xs text-muted-foreground px-1 pt-1">{{ t('batten.save_dialog.no_fixtures') }}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="saveDialogOpen = false">{{ t('action.cancel') }}</Button>
        <Button :disabled="!!savingBattenId || !saveName.trim()" @click="confirmSaveDialog">{{ t('action.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { useMeasureUnit } from '@/composables/useMeasureUnit'
import { useConfirm } from '@/composables/useConfirm.js'
import { useSaveToTemplateDialog } from '@/composables/useSaveToTemplateDialog'
const { t } = useLocale()
const { confirm } = useConfirm()

const { unit, unitLabel, formatLength, cmToDisplay, parseToCm, parseDecimal, inputStep, lengthMin, lengthMax } = useMeasureUnit()
import { Plus, Pencil, Trash2, BookmarkPlus, Loader2, AlignJustify } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import HelpIcon from '@/components/ui/HelpIcon.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import BattenVisualization from './BattenVisualization.vue'
import ChannelPickerGrid from './ChannelPickerGrid.vue'

const props = defineProps({
  battens: { type: Array, required: true },
  channels: { type: Array, required: true },
  preselectedChannelId: { type: String, default: null },
  saveToTemplateFn: { type: Function, default: null },
  templateName: { type: String, default: null },
  fetchTemplateNamesFn: { type: Function, default: null },
  fromTemplateFn: { type: Function, default: null },
})

const emit = defineEmits(['assigned', 'navigate-to-channel', 'reordered'])

// CRUD kommt aus ShowDetailView.vue (provide('showBattens', ...)) per
// provide/inject statt als einzelne Function-Props — das teilt eine Instanz
// von useShowBattens() (dieselben battens/loading-Refs wie z.B. die generierte
// Obermaschinerie-Übersicht in ShowDetailView.vue) statt sie hier ein
// zweites Mal zu erzeugen.
const { addBatten, saveBatten, removeBatten, removeAllBattens, assignFixture, updateFixtureNotes, unassignFixture, reorderBattens } = inject('showBattens')

// Typ (Batten / Traverse / PointBatten)
const BATTEN_TYPES = ['batten', 'traverse', 'point_batten']
function typeLabel(type) { return t(`batten.type.${type || 'batten'}`) }
const battenTypeOptions = computed(() => BATTEN_TYPES.map(value => ({ value, label: typeLabel(value) })))

const SCALE_ORIGINS = ['left', 'center', 'right']
const scaleOriginOptions = computed(() => SCALE_ORIGINS.map(value => ({ value, label: t(`batten.scale.origin.${value}`) })))

const typeFilter = ref('all')
const filteredBattens = computed(() => typeFilter.value === 'all' ? props.battens : props.battens.filter(b => (b.batten_type || 'batten') === typeFilter.value))
const typeFilterOptions = computed(() => [
  { value: 'all', label: t('batten.type.filter.all') },
  ...BATTEN_TYPES.map(value => ({ value, label: typeLabel(value), count: props.battens.filter(b => (b.batten_type || 'batten') === value).length })),
].filter(opt => opt.value === 'all' || opt.count > 0))

// Als Vorlage speichern
const {
  saveDialogOpen, savingId: savingBattenId, saveDialogItem: saveDialogBatten,
  saveFields, saveName, saveNameConflict, saveConfirmOverwrite,
  openSaveDialog, confirmSaveDialog,
} = useSaveToTemplateDialog(props.saveToTemplateFn, props.fetchTemplateNamesFn, { position: true, channel: true, device: true, color: true, notes: false })

// Drag & Drop — arbeitet auf einer lokalen Kopie, Prop-Array bleibt readonly
const localBattens = computed(() => props.battens)
const draggedId = ref(null)
const dragOverId = ref(null)

function onBattenDragStart(id) { draggedId.value = id }
function onBattenDragOver(e, id) { e.preventDefault(); dragOverId.value = id }
function onBattenDrop(targetId) {
  const arr = [...localBattens.value]
  const from = arr.findIndex(b => b.id === draggedId.value)
  const to = arr.findIndex(b => b.id === targetId)
  if (from === -1 || to === -1 || from === to) { draggedId.value = null; dragOverId.value = null; return }
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
  reorderBattens(arr.map(b => b.id))
  emit('reordered', arr)
  draggedId.value = null; dragOverId.value = null
}
function onBattenDragEnd() { draggedId.value = null; dragOverId.value = null }

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})
function channelForId(id) { return channelById.value.get(id) ?? null }
function channelNr(id) { return channelForId(id)?.channel ?? '?' }
function channelDevice(id) { return channelForId(id)?.device ?? '' }

function isPointBatten(batten) { return batten?.batten_type === 'point_batten' }

function goToChannel(channelId) {
  emit('navigate-to-channel', channelId)
}

// Batten Dialog
const battenDialogOpen = ref(false)
const editingBatten = ref(null)
const battenForm = ref({ name: '', batten_nr: '', length_cm: 1100, hide_scale: false, batten_type: 'batten', scale_origin: 'center' })
// Anzeige-Wert für length-Input (in gewählter Einheit)
const battenFormDisplay = computed({
  get: () => ({ length: cmToDisplay(battenForm.value.length_cm) }),
  set: (v) => { battenForm.value.length_cm = parseToCm(v.length) },
})

function openNewBattenDialog() {
  editingBatten.value = null
  battenForm.value = { name: '', batten_nr: '', length_cm: 1100, batten_type: typeFilter.value !== 'all' ? typeFilter.value : 'batten', scale_origin: 'center' }
  battenDialogOpen.value = true
}
function openEditBattenDialog(batten) {
  editingBatten.value = batten
  battenForm.value = { name: batten.name, batten_nr: batten.batten_nr, length_cm: batten.length_cm, hide_scale: batten.hide_scale ?? false, batten_type: batten.batten_type || 'batten', scale_origin: batten.scale_origin || 'center' }
  battenDialogOpen.value = true
}
async function saveBattenForm() {
  if (!battenForm.value.name) return
  if (editingBatten.value) {
    await saveBatten(editingBatten.value.id, { ...battenForm.value, height_cm: editingBatten.value.height_cm ?? null, notes: editingBatten.value.notes ?? '' })
    editingBatten.value.hide_scale = battenForm.value.hide_scale
    editingBatten.value.batten_type = battenForm.value.batten_type
    editingBatten.value.scale_origin = battenForm.value.scale_origin
  } else {
    await addBatten({ ...battenForm.value })
  }
  battenDialogOpen.value = false
}
const removeConfirmOpen = ref(false)
const removeConfirmText = ref('')
const removePending = ref(null)

function confirmRemoveFixture(fx, batten) {
  const nr = channelNr(fx.channel_id)
  const dev = channelDevice(fx.channel_id)
  const fixture = nr !== '?' ? `Kanal ${nr}${dev ? ' · ' + dev : ''}` : fx.id
  removeConfirmText.value = t('batten.fixture.remove.confirm', { fixture, batten: batten.name })
  removePending.value = { battenId: batten.id, fixtureId: fx.id }
  removeConfirmOpen.value = true
}

function doRemoveFixture() {
  if (!removePending.value) return
  unassignFixture(removePending.value.battenId, removePending.value.fixtureId)
  removeConfirmOpen.value = false
  removePending.value = null
}

async function saveInlineField(batten, field, value) {
  await saveBatten(batten.id, { name: batten.name, batten_nr: batten.batten_nr, length_cm: batten.length_cm, height_cm: batten.height_cm, notes: batten.notes, hide_scale: batten.hide_scale ?? false, batten_type: batten.batten_type || 'batten', scale_origin: batten.scale_origin || 'center', [field]: value })
  batten[field] = value
}



async function confirmDeleteBatten(batten) {
  const ok = await confirm({ t, titleKey: 'batten.delete.confirm', titleParams: { name: batten.name }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (ok) removeBatten(batten.id)
}

async function confirmDeleteAllBattens() {
  const ok = await confirm({ t, titleKey: 'batten.delete_all.confirm', titleParams: { count: props.battens.length }, confirmKey: 'action.delete_all', cancelKey: 'action.cancel' })
  if (!ok) return
  await removeAllBattens()
}

// Fixture Edit Dialog
const fixtureEditOpen = ref(false)
const fixtureEditFx = ref(null)
const fixtureEditBatten = ref(null)
const fixtureEditNotes = ref('')
const fixtureEditLabel = ref('')

function openFixtureEditDialog(fx, batten) {
  fixtureEditFx.value = fx
  fixtureEditBatten.value = batten
  fixtureEditNotes.value = fx.notes ?? ''
  fixtureEditLabel.value = fx.label ?? ''
  fixtureEditOpen.value = true
}

async function saveFixtureEdit() {
  if (!fixtureEditFx.value || !fixtureEditBatten.value) return
  const fx = fixtureEditFx.value
  if (!fx.channel_id) {
    // Generisches Element: label ist Teil der Fixture selbst, nur über
    // assignFixture (POST) statt der reinen Notes-PATCH-Route änderbar.
    if (!fixtureEditLabel.value.trim()) return
    await assignFixture(fixtureEditBatten.value.id, fx.position, { label: fixtureEditLabel.value.trim(), notes: fixtureEditNotes.value, fixtureId: fx.id, side: fx.side || 'out', positionText: fx.position_text })
    fx.label = fixtureEditLabel.value.trim()
  } else {
    await updateFixtureNotes(fixtureEditBatten.value.id, fx.id, fixtureEditNotes.value)
  }
  fx.notes = fixtureEditNotes.value
  fixtureEditOpen.value = false
}

// Fixture Picker
const fixturePickerOpen = ref(false)
const pickerMode = ref('list') // 'list' | 'channel' | 'generic'
const pickerChannel = ref(null)
const pickerLabel = ref('')
const pickerNotes = ref('')
const pickerPosition = ref(0)
const pickerBatten = ref(null)
const pickerSide = ref('out')

function resetPicker(batten, position, side) {
  pickerBatten.value = batten
  pickerChannel.value = null
  pickerLabel.value = ''
  pickerNotes.value = ''
  pickerMode.value = 'list'
  pickerPosition.value = position
  pickerSide.value = side
  fixturePickerOpen.value = true
}

function onBattenPositionPick(batten, position, side = 'out') {
  resetPicker(batten, position, side)
}

function onPointBattenAddClick(batten) {
  resetPicker(batten, 0, 'out')
}

async function confirmAddFixture() {
  if (!pickerBatten.value) return
  if (pickerMode.value === 'generic') {
    if (!pickerLabel.value.trim()) return
    const half = (pickerBatten.value.length_cm ?? 600) / 2
    const pos = Math.max(-half, Math.min(half, pickerPosition.value))
    await assignFixture(pickerBatten.value.id, pos, { label: pickerLabel.value.trim(), side: pickerSide.value })
  } else {
    if (!pickerChannel.value) return
    const qty = Math.max(1, pickerChannel.value.quantity ?? 1)
    const spacing = qty > 1 ? 30 : 0
    const startPos = pickerPosition.value - ((qty - 1) * spacing) / 2
    for (let i = 0; i < qty; i++) {
      const pos = Math.round((startPos + i * spacing) / 10) * 10
      const half = (pickerBatten.value.length_cm ?? 600) / 2
      await assignFixture(pickerBatten.value.id, Math.max(-half, Math.min(half, pos)), { channelId: pickerChannel.value.id, side: pickerSide.value, notes: pickerNotes.value.trim() })
    }
  }
  fixturePickerOpen.value = false
  pickerChannel.value = null
  emit('assigned')
}

async function savePointBattenPositionText(batten, value) {
  const fx = batten.fixtures[0]
  if (!fx) return
  await assignFixture(batten.id, 0, { channelId: fx.channel_id, label: fx.label, fixtureId: fx.id, side: fx.side || 'out', positionText: value })
  fx.position_text = value
}

async function onFixtureDragEnd(batten, fx) {
  await assignFixture(batten.id, fx.position, { channelId: fx.channel_id, label: fx.label, fixtureId: fx.id, side: fx.side || 'out', positionText: fx.position_text })
}
</script>

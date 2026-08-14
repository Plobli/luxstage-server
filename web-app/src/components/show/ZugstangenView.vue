<template>
  <div class="relative flex flex-col h-full overflow-hidden">
    <!-- Typ-Filter -->
    <div v-if="bars.length > 0" class="flex items-center gap-1.5 px-5 pt-3 pb-1 shrink-0 overflow-x-auto">
      <button
        v-for="opt in typeFilterOptions"
        :key="opt.value"
        class="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors"
        :class="typeFilter === opt.value ? 'bg-accent/20 border-accent/50 text-accent' : 'border-border/40 text-muted-foreground hover:bg-white/5'"
        @click="typeFilter = opt.value"
      >{{ opt.label }}<span v-if="opt.value !== 'all'" class="ml-1 tabular-nums opacity-60">{{ opt.count }}</span></button>
    </div>

    <!-- Zugstangen-Liste -->
    <div class="flex-1 overflow-y-auto pb-14 md:pb-0">
      <div v-if="bars.length === 0" class="flex flex-col items-center justify-center gap-3 h-64 text-center px-8">
        <AlignJustify class="size-8 text-muted-foreground/40" />
        <div class="max-w-150">
          <p class="text-base font-medium text-foreground/70">{{ t('zugstange.empty') }}</p>
          <p class="text-sm text-muted-foreground mt-1">{{ t('zugstange.empty.desc') }}</p>
        </div>
      </div>
      <div v-else-if="filteredBars.length === 0" class="flex flex-col items-center justify-center gap-3 h-64 text-center px-8">
        <AlignJustify class="size-8 text-muted-foreground/40" />
        <p class="text-sm text-muted-foreground">{{ t('zugstange.empty') }}</p>
      </div>

      <!-- Eine Zeile pro Element -->
      <div
        v-for="bar in filteredBars"
        :key="bar.id"
        draggable="true"
        class="group/row relative flex items-center gap-6 px-5 py-4 mx-3 my-2 rounded-xl border transition-colors"
        :class="dragOverId === bar.id ? 'bg-white/8 border-primary/50' : draggedId === bar.id ? 'opacity-40 border-border/40 bg-white/4' : 'bg-white/4 border-border/40 hover:bg-white/6'"
        @dragstart="onBarDragStart(bar.id)"
        @dragover="onBarDragOver($event, bar.id)"
        @drop="onBarDrop(bar.id)"
        @dragend="onBarDragEnd"
      >
        <!-- Linke Spalte: Name oben, Länge + Höhe unten (bündig zur Anmerkung) -->
        <div class="w-44 shrink-0 self-stretch flex flex-col justify-end">
          <div class="flex items-center gap-1.5 mb-3">
            <span class="text-lg font-semibold text-foreground tracking-tight truncate leading-tight">{{ bar.name }}</span>
          </div>
          <span class="self-start -mt-2 mb-2 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-white/8 text-muted-foreground/70">{{ typeLabel(bar.bar_type) }}</span>
          <div v-if="!isPunktzug(bar)" class="min-w-0">
            <!-- Länge -->
            <div class="relative w-32">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider pointer-events-none">{{ t('zugstange.field.length') }}</span>
              <input
                type="text"
                inputmode="decimal"
                :value="cmToDisplay(bar.length_cm)"
                class="w-full h-8 rounded-md border border-transparent bg-white/3 pl-13 pr-7 text-sm tabular-nums text-right text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
                @change="saveInlineField(bar, 'length_cm', parseToCm(Number($event.target.value)))"
              />
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 pointer-events-none">{{ unit }}</span>
            </div>
            <!-- Höhe -->
            <div class="relative mt-1.5 w-32">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider pointer-events-none">{{ t('zugstange.field.height') }}</span>
              <input
                type="text"
                inputmode="decimal"
                :value="bar.height_cm != null ? cmToDisplay(bar.height_cm) : ''"
                placeholder="—"
                class="w-full h-8 rounded-md border border-transparent bg-white/3 pl-13 pr-7 text-sm tabular-nums text-right text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
                @change="saveInlineField(bar, 'height_cm', $event.target.value === '' ? null : parseToCm(Number($event.target.value)))"
              />
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 pointer-events-none">{{ unit }}</span>
            </div>
          </div>
        </div>

        <!-- Mittlere Spalte: Punktzug — Freitext-Position + ein Kreis -->
        <div v-if="isPunktzug(bar)" class="flex-1 min-w-0 flex items-center gap-4">
          <div class="flex-1 min-w-0">
            <input
              type="text"
              :value="bar.fixtures[0]?.position_text ?? ''"
              :placeholder="t('zugstange.punktzug.position.placeholder')"
              class="w-full h-9 rounded-md border border-transparent bg-white/3 px-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
              @change="savePunktzugPositionText(bar, $event.target.value)"
            />
            <input
              type="text"
              :value="bar.notes ?? ''"
              :placeholder="t('zugstange.notes.placeholder')"
              class="w-full h-8 mt-1.5 rounded-md border border-transparent bg-white/3 px-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
              @change="saveInlineField(bar, 'notes', $event.target.value)"
            />
          </div>
          <div class="shrink-0">
            <div v-if="bar.fixtures[0]" class="relative group/fx">
              <button
                class="size-10 rounded-full border-2 border-accent bg-accent/30 backdrop-blur-sm flex items-center justify-center hover:bg-accent/50 transition-all shadow-lg"
                :class="bar.fixtures[0].notes ? 'ring-2 ring-yellow-400/60' : ''"
                @click="openFixtureEditDialog(bar.fixtures[0], bar)"
              >
                <span class="text-xs font-bold text-white tabular-nums drop-shadow-sm">{{ channelNr(bar.fixtures[0].channel_id) }}</span>
              </button>
              <button
                class="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500/90 text-white items-center justify-center hidden group-hover/fx:flex z-20 hover:bg-red-500 transition-colors shadow"
                @click.stop="confirmRemoveFixture(bar.fixtures[0], bar)"
              ><svg viewBox="0 0 10 10" width="7" height="7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg></button>
            </div>
            <button
              v-else
              class="size-10 rounded-full border-2 border-dashed border-accent/40 bg-accent/5 flex items-center justify-center hover:bg-accent/10 transition-colors"
              @click="onPunktzugAddClick(bar)"
            ><Plus class="size-4 text-accent/60" /></button>
          </div>
        </div>

        <!-- Mittlere Spalte: Stangen-Visualisierung + Anmerkung (gleiche Breite) -->
        <div v-else class="flex-1 min-w-0">
          <div class="relative" :style="{ height: isTraverse(bar) ? '76px' : '60px' }">
            <!-- Skala-Labels oben -->
            <div v-if="!bar.hide_scale" class="absolute left-0 right-0 h-4" style="top: 12px;">
              <span
                v-for="tick in getScaleTicks(bar)"
                :key="tick.pos"
                class="absolute text-[9px] -translate-x-1/2 tabular-nums leading-none"
                :class="tick.center ? 'text-muted-foreground/70 font-semibold' : 'text-muted-foreground/35'"
                :style="{ left: tick.pct + '%' }"
              >{{ tick.label }}</span>
            </div>

            <!-- Traverse: Fachwerk-Kreuzverstrebung zwischen innerer und äußerer Linie -->
            <svg
              v-if="isTraverse(bar)"
              class="absolute left-0 right-0 pointer-events-none"
              style="top: 26px; height: 24px; width: 100%;"
              preserveAspectRatio="none"
              viewBox="0 0 400 30"
            >
              <polyline
                :points="trussLatticePoints().down"
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
              />
              <polyline
                :points="trussLatticePoints().up"
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
              />
            </svg>

            <!-- Traverse: zweite (innere) Linie oberhalb der äußeren -->
            <div
              v-if="isTraverse(bar)"
              class="absolute left-0 right-0 cursor-crosshair"
              style="top: 9px; height: 32px;"
              :data-bar-id="bar.id" data-side="in"
              @click.self="onBarLineClick($event, bar, 'in')"
              @mouseenter="hoverBarId = bar.id; hoverSide = 'in'"
              @mouseleave="hoverBarId = null; hoverPct = null; hoverSide = null"
              @mousemove="hoverBarId = bar.id; hoverSide = 'in'; hoverPct = $event.offsetX / $event.currentTarget.offsetWidth * 100"
            >
              <div class="absolute left-0 right-0 rounded-full bg-white/10 border border-white/15 pointer-events-none" style="top: 13px; height: 4px;" />
              <div
                v-if="hoverBarId === bar.id && hoverSide === 'in' && hoverPct !== null && !hoverOnFixture"
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10"
                :style="{ left: hoverPct + '%' }"
              >
                <div class="size-8 rounded-full border-2 border-accent/40 bg-accent/10 flex items-center justify-center">
                  <span class="text-xs font-bold text-white/40 tabular-nums">+</span>
                </div>
              </div>
              <div
                v-for="fx in barFixturesBySide(bar, 'in')"
                :key="fx.id"
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/fx z-10"
                :style="{ left: posPercent(fx.position, bar.length_cm) + '%' }"
                @mouseenter="hoverOnFixture = true"
                @mouseleave="hoverOnFixture = false"
                @mousedown.prevent.stop="startDrag($event, fx, bar)"
              >
                <button
                  class="size-8 rounded-full border-2 border-accent bg-accent/30 backdrop-blur-sm flex items-center justify-center hover:bg-accent/50 transition-all shadow-lg"
                  :class="fx.notes ? 'ring-2 ring-yellow-400/60' : ''"
                  @click.stop="openFixtureEditDialog(fx, bar)"
                >
                  <span class="text-[10px] font-bold text-white tabular-nums drop-shadow-sm">{{ channelNr(fx.channel_id) }}</span>
                </button>
                <button
                  class="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500/90 text-white items-center justify-center hidden group-hover/fx:flex z-20 hover:bg-red-500 transition-colors shadow"
                  @click.stop="confirmRemoveFixture(fx, bar)"
                ><svg viewBox="0 0 10 10" width="7" height="7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg></button>
              </div>
            </div>

            <!-- Stangen-/Traversen-Linie (außen) + Marker -->
            <div
              class="absolute left-0 right-0 cursor-crosshair"
              :style="{ top: isTraverse(bar) ? '41px' : '9px', height: isTraverse(bar) ? '32px' : '48px' }"
              :data-bar-id="bar.id" data-side="out"
              @click.self="onBarLineClick($event, bar, 'out')"
              @mouseenter="hoverBarId = bar.id; hoverSide = 'out'"
              @mouseleave="hoverBarId = null; hoverPct = null; hoverSide = null"
              @mousemove="hoverBarId = bar.id; hoverSide = 'out'; hoverPct = $event.offsetX / $event.currentTarget.offsetWidth * 100"
            >
              <!-- Stangen-Track -->
              <div
                class="absolute left-0 right-0 rounded-full bg-white/15 border border-white/20 pointer-events-none"
                :style="{ top: isTraverse(bar) ? '13px' : '21px', height: isTraverse(bar) ? '4px' : '6px' }"
              />
              <!-- Statischer Hinweis bei leerer Stange -->
              <div
                v-if="bar.fixtures.length === 0 && hoverBarId !== bar.id"
                class="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none whitespace-nowrap text-xs text-muted-foreground/60"
                :style="{ top: isTraverse(bar) ? '18px' : '34px' }"
              >{{ t('zugstange.scale.click_to_add') }}</div>
              <!-- Ghost-Marker bei Hover -->
              <div
                v-if="hoverBarId === bar.id && hoverSide === 'out' && hoverPct !== null && !hoverOnFixture"
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10"
                :style="{ left: hoverPct + '%' }"
              >
                <div class="rounded-full border-2 border-accent/40 bg-accent/10 flex items-center justify-center" :class="isTraverse(bar) ? 'size-8' : 'size-10'">
                  <span class="text-xs font-bold text-white/40 tabular-nums">+</span>
                </div>
              </div>
              <!-- Tick-Striche -->
              <div
                v-if="!bar.hide_scale && !isTraverse(bar)"
                v-for="tick in getScaleTicks(bar)"
                :key="'t'+tick.pos"
                class="absolute top-1/2 -translate-x-px pointer-events-none"
                :style="{
                  left: tick.pct + '%',
                  height: tick.center ? '16px' : '10px',
                  marginTop: tick.center ? '-8px' : '-5px',
                  width: tick.center ? '2px' : '1px',
                  background: tick.center ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)',
                }"
              />
              <!-- Kanal-Marker -->
              <div
                v-for="fx in barFixturesBySide(bar, 'out')"
                :key="fx.id"
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/fx z-10"
                :style="{ left: posPercent(fx.position, bar.length_cm) + '%' }"
                @mouseenter="hoverOnFixture = true"
                @mouseleave="hoverOnFixture = false"
                @mousedown.prevent.stop="startDrag($event, fx, bar)"
              >
                <button
                  class="rounded-full border-2 border-accent bg-accent/30 backdrop-blur-sm flex items-center justify-center hover:bg-accent/50 transition-all shadow-lg"
                  :class="[fx.notes ? 'ring-2 ring-yellow-400/60' : '', isTraverse(bar) ? 'size-8' : 'size-10']"
                  @click.stop="openFixtureEditDialog(fx, bar)"
                >
                  <span class="font-bold text-white tabular-nums drop-shadow-sm" :class="isTraverse(bar) ? 'text-[10px]' : 'text-xs'">{{ channelNr(fx.channel_id) }}</span>
                </button>
                <button
                  class="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500/90 text-white items-center justify-center hidden group-hover/fx:flex z-20 hover:bg-red-500 transition-colors shadow"
                  @click.stop="confirmRemoveFixture(fx, bar)"
                ><svg viewBox="0 0 10 10" width="7" height="7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg></button>
              </div>
            </div>
          </div>
          <!-- Anmerkung (so breit wie die Stange) -->
          <input
            type="text"
            :value="bar.notes ?? ''"
            :placeholder="t('zugstange.notes.placeholder')"
            class="w-full h-8 mt-5 rounded-md border border-transparent bg-white/3 px-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
            @change="saveInlineField(bar, 'notes', $event.target.value)"
          />
        </div>

        <!-- Rechte Spalte: Aktionen (gestapelt, nur bei Hover) -->
        <div class="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <!-- Als Vorlage speichern -->
          <Button
            v-if="props.saveToTemplateFn"
            variant="ghost" size="icon" class="size-7 text-muted-foreground/60"
            :title="savingBarId === bar.id ? '…' : t('zugstange.save_to_template')"
            @click.stop="openSaveDialog(bar)"
          >
            <Loader2 v-if="savingBarId === bar.id" class="size-3.5 animate-spin" />
            <BookmarkPlus v-else class="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/60" @click="openEditBarDialog(bar)">
            <Pencil class="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/60" @click="confirmDeleteBar(bar)">
            <Trash2 class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Neue Zugstange -->
    <Button variant="accent" @click="openNewBarDialog" class="absolute bottom-20 right-6 md:bottom-6 h-11 px-5 rounded-full shadow-lg flex items-center gap-2">
      <Plus class="size-4" /> {{ t('zugstange.new') }}
    </Button>
  </div>

  <!-- Bar Dialog -->
  <Dialog :open="barDialogOpen" @update:open="barDialogOpen = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editingBar ? t('zugstange.dialog.edit') : t('zugstange.dialog.new') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.field.type') }}</label>
          <div class="flex gap-1.5">
            <button
              v-for="opt in barTypeOptions"
              :key="opt.value"
              type="button"
              class="flex-1 h-9 rounded-md border text-sm font-medium transition-colors"
              :class="barForm.bar_type === opt.value ? 'bg-accent/20 border-accent/50 text-accent' : 'border-border/40 text-muted-foreground hover:bg-white/5'"
              @click="barForm.bar_type = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.field.name') }}</label>
          <Input size="lg" v-model="barForm.name" :placeholder="t('zugstange.name.placeholder')" autofocus />
        </div>
        <div v-if="barForm.bar_type !== 'punktzug'" class="flex flex-col gap-1.5">
          <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
            {{ t('zugstange.field.length_unit', { unit }) }}
            <HelpIcon :text="t('zugstange.field.length.help')" side="right" />
          </label>
          <Input size="lg" :modelValue="barFormDisplay.length" type="number" :min="lengthMin" :max="lengthMax" :step="inputStep" @update:modelValue="barForm.length_cm = parseToCm(Number($event))" />
        </div>
        <button v-if="barForm.bar_type !== 'punktzug'" type="button" class="flex items-center justify-between w-full rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40" @click="barForm.hide_scale = !barForm.hide_scale">
          <span class="flex items-center gap-1.5 text-sm text-foreground">
            {{ t('zugstange.scale.hide') }}
            <HelpIcon :text="t('zugstange.scale.help')" side="right" />
          </span>
          <div class="relative shrink-0 w-9 h-5 rounded-full transition-colors" :class="barForm.hide_scale ? 'bg-accent' : 'bg-muted'">
            <div class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform" :class="barForm.hide_scale ? 'translate-x-4' : 'translate-x-0'" />
          </div>
        </button>
      </DialogBody>
      <DialogFooter>
        <Button v-if="!editingBar && props.fromTemplateFn" variant="ghost" class="mr-auto text-xs text-muted-foreground" @click="barDialogOpen = false; props.fromTemplateFn()">
          {{ t('zugstange.dialog.from_template') }}
        </Button>
        <Button variant="ghost" @click="barDialogOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="saveBarForm">{{ editingBar ? t('action.save') : t('zugstange.action.create') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Remove Confirm Dialog -->
  <Dialog :open="removeConfirmOpen" @update:open="removeConfirmOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('zugstange.fixture.remove.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p class="text-sm text-muted-foreground">{{ removeConfirmText }}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="removeConfirmOpen = false">{{ t('action.cancel') }}</Button>
        <Button variant="destructive" @click="doRemoveFixture">{{ t('zugstange.fixture.remove.action') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Edit Dialog -->
  <Dialog :open="fixtureEditOpen" @update:open="fixtureEditOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Kanal {{ channelNr(fixtureEditFx?.channel_id) }}{{ channelDevice(fixtureEditFx?.channel_id) ? ' · ' + channelDevice(fixtureEditFx?.channel_id) : '' }} — {{ fixtureEditBar?.name }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.fixture.notes.label') }}</label>
          <Input size="lg" v-model="fixtureEditNotes" :placeholder="t('zugstange.fixture.notes.placeholder')" autofocus @keydown.enter="saveFixtureEdit" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" class="mr-auto text-xs text-muted-foreground" @click="goToChannel(fixtureEditFx?.channel_id); fixtureEditOpen = false">{{ t('zugstange.fixture.channel_link') }}</Button>
        <Button variant="ghost" @click="fixtureEditOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="saveFixtureEdit">{{ t('action.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Picker -->
  <Dialog :open="fixturePickerOpen" @update:open="fixturePickerOpen = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t('zugstange.fixture.add') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Input v-if="!pickerChannel" size="lg" v-model="fixtureSearch" :placeholder="t('zugstange.fixture.search.placeholder')" autofocus @keydown.enter="selectFirstAndConfirm" />
        <div v-if="!pickerChannel" class="max-h-64 overflow-y-auto flex flex-col">
          <button
            v-for="ch in filteredChannelsForPicker"
            :key="ch.channel"
            class="flex items-center gap-4 px-4 py-3 text-left transition-colors border-b border-border/30 last:border-b-0"
            :class="pickerChannel?.id === ch.id ? 'bg-accent/20 border-l-2 border-l-accent' : 'hover:bg-muted/40 border-l-2 border-l-transparent'"
            @click="pickerChannel = ch; fixtureSearch = ''"
          >
            <span class="text-2xl font-bold tabular-nums w-10 shrink-0" :class="pickerChannel?.id === ch.id ? 'text-accent' : 'text-foreground'">{{ ch.channel }}</span>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-sm font-semibold truncate" :class="pickerChannel?.id === ch.id ? 'text-accent' : 'text-foreground'">{{ ch.device }}</span>
              <span v-if="ch.address || ch.color" class="text-xs text-muted-foreground mt-0.5">
                <span v-if="ch.address">DMX {{ ch.address }}</span><span v-if="ch.address && ch.color"> · </span><span v-if="ch.color">{{ ch.color }}</span>
              </span>
            </div>
            <svg v-if="pickerChannel?.id === ch.id" class="size-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          </button>
        </div>
        <div v-if="pickerChannel" class="flex flex-col gap-3">
          <div class="flex items-center gap-4 px-4 py-3 rounded-lg bg-accent/10 border border-accent/30">
            <span class="text-2xl font-bold tabular-nums w-10 shrink-0 text-accent">{{ pickerChannel.channel }}</span>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-sm font-semibold text-foreground truncate">{{ pickerChannel.device }}</span>
              <span v-if="pickerChannel.address || pickerChannel.color" class="text-xs text-muted-foreground mt-0.5">
                <span v-if="pickerChannel.address">DMX {{ pickerChannel.address }}</span><span v-if="pickerChannel.address && pickerChannel.color"> · </span><span v-if="pickerChannel.color">{{ pickerChannel.color }}</span>
              </span>
            </div>
            <button class="text-muted-foreground/50 hover:text-foreground transition-colors" @click="pickerChannel = null">
              <svg viewBox="0 0 10 10" width="12" height="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>
            </button>
          </div>
          <div v-if="!isPunktzug(pickerBar)" class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">{{ t('zugstange.fixture.position') }} {{ unitLabel }}</label>
            <Input size="lg" autofocus :modelValue="cmToDisplay(pickerPosition)" type="number" :min="cmToDisplay(-(pickerBar?.length_cm || 600)/2)" :max="cmToDisplay((pickerBar?.length_cm || 600)/2)" :step="inputStep" @update:modelValue="pickerPosition = parseToCm(Number($event))" @keydown.enter="confirmAddFixture" />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="fixturePickerOpen = false">{{ t('action.cancel') }}</Button>
        <Button :disabled="!pickerChannel" @click="confirmAddFixture">{{ t('action.add') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Als Vorlage speichern Dialog -->
  <Dialog :open="saveDialogOpen" @update:open="saveDialogOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('zugstange.save_dialog.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <!-- Ziel + Item-Info -->
        <div class="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5">
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-muted-foreground shrink-0">{{ t('zugstange.save_dialog.template_label') }}</span>
            <span class="text-sm font-medium text-foreground truncate">{{ props.templateName }}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-muted-foreground shrink-0">{{ t('zugstange.save_dialog.length_label') }}</span>
            <span class="text-xs text-muted-foreground">{{ formatLength(saveDialogBar?.length_cm) }}</span>
          </div>
        </div>
        <div>
          <Label class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.name_label') }}</Label>
          <Input size="lg" v-model="saveName" autofocus />
        </div>
        <!-- Überschreiben-Warnung -->
        <div v-if="saveNameConflict" class="rounded-lg border border-destructive/50 bg-destructive/5 px-3.5 py-3 space-y-2">
          <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.conflict', { name: saveName }) }}</p>
          <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.conflict.hint') }}</p>
          <div class="flex gap-2 pt-1">
            <Button size="sm" variant="ghost" @click="saveNameConflict = false">{{ t('action.cancel') }}</Button>
            <Button size="sm" variant="destructive" @click="saveConfirmOverwrite = true; confirmSaveDialog()">{{ t('zugstange.save_dialog.overwrite') }}</Button>
          </div>
        </div>
        <!-- Was wird gespeichert -->
        <div class="space-y-1">
          <!-- Struktur — immer aktiv -->
          <div class="flex items-start gap-3 py-2 opacity-60">
            <Checkbox :model-value="true" disabled class="mt-0.5" />
            <div>
              <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.structure') }}</p>
              <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.structure.desc') }}</p>
            </div>
          </div>
          <!-- Scheinwerfer-Trennlinie -->
          <div v-if="saveDialogBar?.fixtures?.length" class="pt-1">
            <p class="text-xs font-semibold text-muted-foreground px-1 pb-1">
              {{ t('zugstange.save_dialog.fixtures_count', { count: saveDialogBar.fixtures.length }) }}
            </p>
            <div class="h-px bg-border/50 mx-1 mb-1" />
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.position" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.field.position') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.field.position.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.channel" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.field.channel') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.field.channel.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.device" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.field.device') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.field.device.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.notes" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.field.notes') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.field.notes.desc') }}</p>
              </div>
            </label>
          </div>
          <p v-else class="text-xs text-muted-foreground px-1 pt-1">{{ t('zugstange.save_dialog.no_fixtures') }}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="saveDialogOpen = false">{{ t('action.cancel') }}</Button>
        <Button :disabled="!!savingBarId || !saveName.trim()" @click="confirmSaveDialog">{{ t('action.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { useMeasureUnit } from '@/composables/useMeasureUnit'
import { useConfirm } from '@/composables/useConfirm.js'
const { t } = useLocale()
const { confirm } = useConfirm()

const { unit, unitLabel, formatLength, cmToDisplay, parseToCm, inputStep, lengthMin, lengthMax } = useMeasureUnit()
import { Plus, Pencil, Trash2, BookmarkPlus, Loader2, AlignJustify } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import HelpIcon from '@/components/ui/HelpIcon.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'

const props = defineProps({
  bars: { type: Array, required: true },
  channels: { type: Array, required: true },
  preselectedChannelId: { type: String, default: null },
  addBarFn: { type: Function, required: true },
  saveBarFn: { type: Function, required: true },
  deleteBarFn: { type: Function, required: true },
  assignFixtureFn: { type: Function, required: true },
  updateFixtureNotesFn: { type: Function, required: true },
  unassignFixtureFn: { type: Function, required: true },
  reorderBarsFn: { type: Function, default: null },
  saveToTemplateFn: { type: Function, default: null },
  templateName: { type: String, default: null },
  fetchTemplateNamesFn: { type: Function, default: null },
  fromTemplateFn: { type: Function, default: null },
})

const emit = defineEmits(['assigned', 'navigate-to-channel', 'reordered'])

// Typ (Zugstange / Traverse / Punktzug)
const BAR_TYPES = ['zugstange', 'traverse', 'punktzug']
function typeLabel(type) { return t(`zugstange.type.${type || 'zugstange'}`) }
const barTypeOptions = computed(() => BAR_TYPES.map(value => ({ value, label: typeLabel(value) })))

const typeFilter = ref('all')
const filteredBars = computed(() => typeFilter.value === 'all' ? props.bars : props.bars.filter(b => (b.bar_type || 'zugstange') === typeFilter.value))
const typeFilterOptions = computed(() => [
  { value: 'all', label: t('zugstange.type.filter.all') },
  ...BAR_TYPES.map(value => ({ value, label: typeLabel(value), count: props.bars.filter(b => (b.bar_type || 'zugstange') === value).length })),
].filter(opt => opt.value === 'all' || opt.count > 0))

// Als Vorlage speichern
const saveDialogOpen = ref(false)
const savingBarId = ref(null)
const saveDialogBar = ref(null)
const saveFields = ref({ position: true, channel: true, device: true, color: true, notes: false })
const saveName = ref('')
const existingTemplateNames = ref(new Set())
const saveNameConflict = ref(false)
const saveConfirmOverwrite = ref(false)

async function openSaveDialog(bar) {
  saveDialogBar.value = bar
  saveFields.value = { position: true, channel: true, device: true, color: true, notes: false }
  saveName.value = bar.name
  saveNameConflict.value = false
  saveConfirmOverwrite.value = false
  saveDialogOpen.value = true
  if (props.fetchTemplateNamesFn) {
    const names = await props.fetchTemplateNamesFn()
    existingTemplateNames.value = new Set(names)
  }
}

watch(saveName, () => {
  saveNameConflict.value = false
  saveConfirmOverwrite.value = false
})

async function confirmSaveDialog() {
  const bar = saveDialogBar.value
  if (!bar || !saveName.value.trim()) return
  const name = saveName.value.trim()
  if (!saveConfirmOverwrite.value && existingTemplateNames.value.has(name)) {
    saveNameConflict.value = true
    return
  }
  savingBarId.value = bar.id
  try {
    await props.saveToTemplateFn(bar, { ...saveFields.value }, name)
    saveDialogOpen.value = false
    saveNameConflict.value = false
    saveConfirmOverwrite.value = false
  } finally {
    savingBarId.value = null
  }
}

// Drag & Drop — arbeitet auf einer lokalen Kopie, Prop-Array bleibt readonly
const localBars = computed(() => props.bars)
const draggedId = ref(null)
const dragOverId = ref(null)

function onBarDragStart(id) { draggedId.value = id }
function onBarDragOver(e, id) { e.preventDefault(); dragOverId.value = id }
function onBarDrop(targetId) {
  const arr = [...localBars.value]
  const from = arr.findIndex(b => b.id === draggedId.value)
  const to = arr.findIndex(b => b.id === targetId)
  if (from === -1 || to === -1 || from === to) { draggedId.value = null; dragOverId.value = null; return }
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
  if (props.reorderBarsFn) props.reorderBarsFn(arr.map(b => b.id))
  emit('reordered', arr)
  draggedId.value = null; dragOverId.value = null
}
function onBarDragEnd() { draggedId.value = null; dragOverId.value = null }

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})
function channelForId(id) { return channelById.value.get(id) ?? null }
function channelNr(id) { return channelForId(id)?.channel ?? '?' }
function channelDevice(id) { return channelForId(id)?.device ?? '' }

function posPercent(pos, lengthCm) {
  const len = lengthCm || 600
  return Math.max(0, Math.min(100, ((pos + len / 2) / len) * 100))
}

function isPunktzug(bar) { return bar?.bar_type === 'punktzug' }
function isTraverse(bar) { return bar?.bar_type === 'traverse' }
function barFixturesBySide(bar, side) {
  if (!isTraverse(bar)) return bar.fixtures
  return bar.fixtures.filter(fx => (fx.side || 'out') === side)
}

// Fachwerk-Kreuzverstrebung für die Traversen-Visualisierung.
// Feste Segmentzahl (unabhängig von der Stangenlänge) + preserveAspectRatio="none"
// sorgt dafür, dass das Muster bei jeder Container-Breite gleichmäßig bleibt.
const TRUSS_SEGMENTS = 20
const TRUSS_VIEWBOX_W = 400
function trussLatticePoints() {
  const segW = TRUSS_VIEWBOX_W / TRUSS_SEGMENTS
  const down = []
  const up = []
  for (let i = 0; i <= TRUSS_SEGMENTS; i++) {
    const x = i * segW
    down.push(`${x},${i % 2 === 0 ? 0 : 30}`)
    up.push(`${x},${i % 2 === 0 ? 30 : 0}`)
  }
  return { down: down.join(' '), up: up.join(' ') }
}

function getScaleTicks(bar) {
  const len = bar.length_cm || 600
  const half = len / 2
  const labelStep = 50
  const ticks = []
  for (let cm = -half; cm <= half + 0.01; cm += 50) {
    const snapped = Math.round(cm)
    const isCenter = snapped === 0
    const hasLabel = Math.abs(snapped % labelStep) < 0.5
    const displayVal = cmToDisplay(snapped)
    ticks.push({
      pos: snapped,
      pct: posPercent(snapped, len),
      center: isCenter,
      label: hasLabel ? (isCenter ? '0' : `${displayVal}`) : null,
    })
  }
  return ticks
}

function goToChannel(channelId) {
  emit('navigate-to-channel', channelId)
}

// Bar Dialog
const barDialogOpen = ref(false)
const editingBar = ref(null)
const barForm = ref({ name: '', zug_nr: '', length_cm: 1100, hide_scale: false, bar_type: 'zugstange' })
// Anzeige-Wert für length-Input (in gewählter Einheit)
const barFormDisplay = computed({
  get: () => ({ length: cmToDisplay(barForm.value.length_cm) }),
  set: (v) => { barForm.value.length_cm = parseToCm(v.length) },
})

function openNewBarDialog() {
  editingBar.value = null
  barForm.value = { name: '', zug_nr: '', length_cm: 1100, bar_type: typeFilter.value !== 'all' ? typeFilter.value : 'zugstange' }
  barDialogOpen.value = true
}
function openEditBarDialog(bar) {
  editingBar.value = bar
  barForm.value = { name: bar.name, zug_nr: bar.zug_nr, length_cm: bar.length_cm, hide_scale: bar.hide_scale ?? false, bar_type: bar.bar_type || 'zugstange' }
  barDialogOpen.value = true
}
async function saveBarForm() {
  if (!barForm.value.name) return
  if (editingBar.value) {
    await props.saveBarFn(editingBar.value.id, { ...barForm.value, height_cm: editingBar.value.height_cm ?? null, notes: editingBar.value.notes ?? '' })
    editingBar.value.hide_scale = barForm.value.hide_scale
    editingBar.value.bar_type = barForm.value.bar_type
  } else {
    await props.addBarFn({ ...barForm.value })
  }
  barDialogOpen.value = false
}
const removeConfirmOpen = ref(false)
const removeConfirmText = ref('')
const removePending = ref(null)

function confirmRemoveFixture(fx, bar) {
  const nr = channelNr(fx.channel_id)
  const dev = channelDevice(fx.channel_id)
  const fixture = nr !== '?' ? `Kanal ${nr}${dev ? ' · ' + dev : ''}` : fx.id
  removeConfirmText.value = t('zugstange.fixture.remove.confirm', { fixture, bar: bar.name })
  removePending.value = { barId: bar.id, fixtureId: fx.id }
  removeConfirmOpen.value = true
}

function doRemoveFixture() {
  if (!removePending.value) return
  props.unassignFixtureFn(removePending.value.barId, removePending.value.fixtureId)
  removeConfirmOpen.value = false
  removePending.value = null
}

async function saveInlineField(bar, field, value) {
  await props.saveBarFn(bar.id, { name: bar.name, zug_nr: bar.zug_nr, length_cm: bar.length_cm, height_cm: bar.height_cm, notes: bar.notes, hide_scale: bar.hide_scale ?? false, bar_type: bar.bar_type || 'zugstange', [field]: value })
  bar[field] = value
}



async function confirmDeleteBar(bar) {
  const ok = await confirm({ t, titleKey: 'zugstange.delete.confirm', titleParams: { name: bar.name }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (ok) props.deleteBarFn(bar.id)
}

// Fixture Edit Dialog
const fixtureEditOpen = ref(false)
const fixtureEditFx = ref(null)
const fixtureEditBar = ref(null)
const fixtureEditNotes = ref('')

function openFixtureEditDialog(fx, bar) {
  if (didDrag) { didDrag = false; return }
  fixtureEditFx.value = fx
  fixtureEditBar.value = bar
  fixtureEditNotes.value = fx.notes ?? ''
  fixtureEditOpen.value = true
}

async function saveFixtureEdit() {
  if (!fixtureEditFx.value || !fixtureEditBar.value) return
  await props.updateFixtureNotesFn(fixtureEditBar.value.id, fixtureEditFx.value.id, fixtureEditNotes.value)
  fixtureEditFx.value.notes = fixtureEditNotes.value
  fixtureEditOpen.value = false
}

// Fixture Picker
const fixturePickerOpen = ref(false)
const fixtureSearch = ref('')
const pickerChannel = ref(null)
const pickerPosition = ref(0)
const pickerBar = ref(null)
const pickerSide = ref('out')

const filteredChannelsForPicker = computed(() => {
  const q = fixtureSearch.value.trim().toLowerCase()
  return props.channels.filter(ch => {
    if (!q) return true
    return (ch.channel ?? '').toLowerCase().includes(q) || (ch.device ?? '').toLowerCase().includes(q)
  }).slice(0, 50)
})

function onBarLineClick(event, bar, side = 'out') {
  // Klickposition in cm umrechnen
  const rect = event.currentTarget.getBoundingClientRect()
  const pct = (event.clientX - rect.left) / rect.width
  const len = bar.length_cm || 600
  const rawCm = pct * len - len / 2
  const snapped = Math.round(rawCm / 10) * 10

  pickerBar.value = bar
  pickerChannel.value = null
  pickerPosition.value = Math.max(-len / 2, Math.min(len / 2, snapped))
  pickerSide.value = side
  fixtureSearch.value = ''
  fixturePickerOpen.value = true
}

function onPunktzugAddClick(bar) {
  pickerBar.value = bar
  pickerChannel.value = null
  pickerPosition.value = 0
  pickerSide.value = 'out'
  fixtureSearch.value = ''
  fixturePickerOpen.value = true
}

function selectFirstAndConfirm() {
  const first = filteredChannelsForPicker.value[0]
  if (first) pickerChannel.value = first
  confirmAddFixture()
}

async function confirmAddFixture() {
  if (!pickerChannel.value || !pickerBar.value) return
  const qty = Math.max(1, pickerChannel.value.quantity ?? 1)
  const spacing = qty > 1 ? 30 : 0
  const startPos = pickerPosition.value - ((qty - 1) * spacing) / 2
  for (let i = 0; i < qty; i++) {
    const pos = Math.round((startPos + i * spacing) / 10) * 10
    const half = (pickerBar.value.length_cm ?? 600) / 2
    await props.assignFixtureFn(pickerBar.value.id, pickerChannel.value.id, Math.max(-half, Math.min(half, pos)), undefined, pickerSide.value)
  }
  fixturePickerOpen.value = false
  pickerChannel.value = null
  emit('assigned')
}

async function savePunktzugPositionText(bar, value) {
  const fx = bar.fixtures[0]
  if (!fx) return
  await props.assignFixtureFn(bar.id, fx.channel_id, 0, fx.id, fx.side || 'out', value)
  fx.position_text = value
}

// Hover-Tooltip
const hoverBarId = ref(null)
const hoverPct = ref(null)
const hoverSide = ref(null)
const hoverOnFixture = ref(false)


// Drag
let dragging = null
let dragBarLineEl = null
let didDrag = false

function startDrag(e, fx, bar) {
  const barEl = e.currentTarget.closest('[data-bar-id]')
  dragBarLineEl = barEl
  dragging = { fx, bar, startX: e.clientX, startPos: fx.position }
  didDrag = false
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  if (!dragging || !dragBarLineEl) return
  const len = dragging.bar.length_cm
  const rect = dragBarLineEl.getBoundingClientRect()
  const dx = e.clientX - dragging.startX
  if (Math.abs(dx) > 3) didDrag = true
  const cmPerPx = len / rect.width
  const raw = dragging.startPos + dx * cmPerPx
  const snapped = Math.round(raw / 10) * 10
  const half = len / 2
  dragging.fx.position = Math.max(-half, Math.min(half, snapped))
}

async function onDragEnd() {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  if (!dragging) return
  const { fx, bar } = dragging
  dragging = null
  dragBarLineEl = null
  await props.assignFixtureFn(bar.id, fx.channel_id, fx.position, fx.id, fx.side || 'out', fx.position_text)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
})
</script>

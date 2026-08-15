<template>
  <!-- Punktzug: ein Kreis links, Freitext-Position rechts -->
  <div v-if="isPunktzug" class="flex-1 min-w-0 flex items-center gap-8">
    <div class="shrink-0">
      <div v-if="bar.fixtures[0]" class="relative group/fx">
        <button
          class="size-14 rounded-full border-2 border-accent bg-accent/30 backdrop-blur-sm flex items-center justify-center hover:bg-accent/50 transition-all shadow-lg"
          :class="bar.fixtures[0].notes ? 'ring-2 ring-yellow-400/60' : ''"
          @click="$emit('editFixture', bar.fixtures[0])"
        >
          <span class="text-base font-bold text-white tabular-nums drop-shadow-sm">{{ channelNr(bar.fixtures[0].channel_id) }}</span>
        </button>
        <button
          class="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-red-500/90 text-white items-center justify-center hidden group-hover/fx:flex z-20 hover:bg-red-500 transition-colors shadow"
          @click.stop="$emit('removeFixture', bar.fixtures[0])"
        ><svg viewBox="0 0 10 10" width="7" height="7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg></button>
      </div>
      <button
        v-else
        class="size-14 rounded-full border-2 border-dashed border-accent/40 bg-accent/5 flex items-center justify-center hover:bg-accent/10 transition-colors"
        @click="$emit('punktzugAddClick')"
      ><Plus class="size-5 text-accent/60" /></button>
    </div>
    <div class="flex-1 min-w-0">
      <input
        type="text"
        :value="bar.fixtures[0]?.position_text ?? ''"
        :placeholder="t('zugstange.punktzug.position.placeholder')"
        class="w-full h-9 rounded-md border border-transparent bg-white/3 px-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
        @change="$emit('savePunktzugPositionText', $event.target.value)"
      />
      <input
        type="text"
        :value="bar.notes ?? ''"
        :placeholder="t('zugstange.notes.placeholder')"
        class="w-full h-8 mt-1.5 rounded-md border border-transparent bg-white/3 px-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
        @change="$emit('saveInlineField', 'notes', $event.target.value)"
      />
    </div>
  </div>

  <!-- Stangen-/Traversen-Visualisierung + Anmerkung (gleiche Breite) -->
  <div v-else class="flex-1 min-w-0">
    <div class="relative" :style="{ height: isTraverse ? '76px' : '60px' }">
      <!-- Skala-Labels oben -->
      <div v-if="!bar.hide_scale" class="absolute left-0 right-0 h-4" style="top: 12px;">
        <span
          v-for="tick in scaleTicks"
          :key="tick.pos"
          class="absolute text-[9px] -translate-x-1/2 tabular-nums leading-none"
          :class="tick.center ? 'text-muted-foreground/70 font-semibold' : 'text-muted-foreground/35'"
          :style="{ left: tick.pct + '%' }"
        >{{ tick.label }}</span>
      </div>

      <!-- Traverse: Fachwerk-Kreuzverstrebung zwischen innerer und äußerer Linie -->
      <svg
        v-if="isTraverse"
        class="absolute left-0 right-0 pointer-events-none"
        style="top: 26px; height: 28px; width: 100%;"
        preserveAspectRatio="none"
        viewBox="0 0 400 30"
      >
        <polyline :points="trussLatticePoints.down" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
        <polyline :points="trussLatticePoints.up" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
      </svg>

      <!-- Traverse: zweite (innere) Linie oberhalb der äußeren -->
      <div
        v-if="isTraverse"
        class="absolute left-0 right-0 cursor-crosshair"
        style="top: 9px; height: 32px;"
        :data-bar-id="bar.id" data-side="in"
        @click.self="onLineClick($event, 'in')"
        @mouseenter="hoverSide = 'in'"
        @mouseleave="hoverPct = null; hoverSide = null"
        @mousemove="hoverSide = 'in'; hoverPct = $event.offsetX / $event.currentTarget.offsetWidth * 100"
      >
        <div class="absolute left-0 right-0 rounded-full bg-white/10 border border-white/15 pointer-events-none" style="top: 13px; height: 4px;" />
        <div
          v-if="hoverSide === 'in' && hoverPct !== null && !hoverOnFixture"
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10"
          :style="{ left: hoverPct + '%' }"
        >
          <div class="size-8 rounded-full border-2 border-accent/40 bg-accent/10 flex items-center justify-center">
            <span class="text-xs font-bold text-white/40 tabular-nums">+</span>
          </div>
        </div>
        <div
          v-for="fx in fixturesBySide('in')"
          :key="fx.id"
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/fx z-10"
          :style="{ left: posPercent(fx.position) + '%' }"
          @mouseenter="hoverOnFixture = true"
          @mouseleave="hoverOnFixture = false"
          @mousedown.prevent.stop="onFixtureDragStart($event, fx)"
        >
          <button
            class="size-8 rounded-full border-2 border-accent bg-accent/30 backdrop-blur-sm flex items-center justify-center hover:bg-accent/50 transition-all shadow-lg"
            :class="fx.notes ? 'ring-2 ring-yellow-400/60' : ''"
            @click.stop="onFixtureClick(fx)"
          >
            <span class="text-[10px] font-bold text-white tabular-nums drop-shadow-sm">{{ channelNr(fx.channel_id) }}</span>
          </button>
          <button
            class="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500/90 text-white items-center justify-center hidden group-hover/fx:flex z-20 hover:bg-red-500 transition-colors shadow"
            @click.stop="$emit('removeFixture', fx)"
          ><svg viewBox="0 0 10 10" width="7" height="7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg></button>
        </div>
      </div>

      <!-- Stangen-/Traversen-Linie (außen) + Marker -->
      <div
        class="absolute left-0 right-0 cursor-crosshair"
        :style="{ top: isTraverse ? '41px' : '9px', height: isTraverse ? '32px' : '48px' }"
        :data-bar-id="bar.id" data-side="out"
        @click.self="onLineClick($event, 'out')"
        @mouseenter="hoverSide = 'out'"
        @mouseleave="hoverPct = null; hoverSide = null"
        @mousemove="hoverSide = 'out'; hoverPct = $event.offsetX / $event.currentTarget.offsetWidth * 100"
      >
        <!-- Stangen-Track -->
        <div
          class="absolute left-0 right-0 rounded-full bg-white/15 border border-white/20 pointer-events-none"
          :style="{ top: isTraverse ? '13px' : '21px', height: isTraverse ? '4px' : '6px' }"
        />
        <!-- Statischer Hinweis bei leerer Stange -->
        <div
          v-if="bar.fixtures.length === 0 && !hoverSide"
          class="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none whitespace-nowrap text-xs text-muted-foreground/60"
          :style="{ top: isTraverse ? '18px' : '34px' }"
        >{{ t('zugstange.scale.click_to_add') }}</div>
        <!-- Ghost-Marker bei Hover -->
        <div
          v-if="hoverSide === 'out' && hoverPct !== null && !hoverOnFixture"
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10"
          :style="{ left: hoverPct + '%' }"
        >
          <div class="rounded-full border-2 border-accent/40 bg-accent/10 flex items-center justify-center" :class="isTraverse ? 'size-8' : 'size-10'">
            <span class="text-xs font-bold text-white/40 tabular-nums">+</span>
          </div>
        </div>
        <!-- Tick-Striche -->
        <div
          v-if="!bar.hide_scale && !isTraverse"
          v-for="tick in scaleTicks"
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
          v-for="fx in fixturesBySide('out')"
          :key="fx.id"
          class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/fx z-10"
          :style="{ left: posPercent(fx.position) + '%' }"
          @mouseenter="hoverOnFixture = true"
          @mouseleave="hoverOnFixture = false"
          @mousedown.prevent.stop="onFixtureDragStart($event, fx)"
        >
          <button
            class="rounded-full border-2 border-accent bg-accent/30 backdrop-blur-sm flex items-center justify-center hover:bg-accent/50 transition-all shadow-lg"
            :class="[fx.notes ? 'ring-2 ring-yellow-400/60' : '', isTraverse ? 'size-8' : 'size-10']"
            @click.stop="onFixtureClick(fx)"
          >
            <span class="font-bold text-white tabular-nums drop-shadow-sm" :class="isTraverse ? 'text-[10px]' : 'text-xs'">{{ channelNr(fx.channel_id) }}</span>
          </button>
          <button
            class="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-red-500/90 text-white items-center justify-center hidden group-hover/fx:flex z-20 hover:bg-red-500 transition-colors shadow"
            @click.stop="$emit('removeFixture', fx)"
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
      @change="$emit('saveInlineField', 'notes', $event.target.value)"
    />
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { useMeasureUnit } from '@/composables/useMeasureUnit'
import { Plus } from 'lucide-vue-next'

const { t } = useLocale()
const { cmToDisplay } = useMeasureUnit()

const props = defineProps({
  bar: { type: Object, required: true },
  channels: { type: Array, required: true },
})

const emit = defineEmits([
  'editFixture', 'removeFixture', 'punktzugAddClick', 'savePunktzugPositionText',
  'saveInlineField', 'lineClick', 'fixtureDragEnd',
])

const isPunktzug = computed(() => props.bar?.bar_type === 'punktzug')
const isTraverse = computed(() => props.bar?.bar_type === 'traverse')

function fixturesBySide(side) {
  if (!isTraverse.value) return props.bar.fixtures
  return props.bar.fixtures.filter(fx => (fx.side || 'out') === side)
}

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})
function channelNr(id) { return channelById.value.get(id)?.channel ?? '?' }

function posPercent(pos) {
  const len = props.bar.length_cm || 600
  return Math.max(0, Math.min(100, ((pos + len / 2) / len) * 100))
}

// Fachwerk-Kreuzverstrebung für die Traversen-Visualisierung.
// viewBox-Höhe entspricht exakt der CSS-Pixelhöhe (keine Y-Streckung) —
// preserveAspectRatio="none" staucht dadurch nur horizontal, Winkel bleiben sauber.
const TRUSS_H = 30
const TRUSS_SEGMENTS = 20
const TRUSS_VIEWBOX_W = 400
const trussLatticePoints = computed(() => {
  const segW = TRUSS_VIEWBOX_W / TRUSS_SEGMENTS
  const down = []
  const up = []
  for (let i = 0; i <= TRUSS_SEGMENTS; i++) {
    const x = i * segW
    down.push(`${x},${i % 2 === 0 ? 0 : TRUSS_H}`)
    up.push(`${x},${i % 2 === 0 ? TRUSS_H : 0}`)
  }
  return { down: down.join(' '), up: up.join(' ') }
})

const scaleTicks = computed(() => {
  const len = props.bar.length_cm || 600
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
      pct: posPercent(snapped),
      center: isCenter,
      label: hasLabel ? (isCenter ? '0' : `${displayVal}`) : null,
    })
  }
  return ticks
})

// Hover-Tooltip (pro Instanz — eine BarVisualization pro Bar)
const hoverPct = ref(null)
const hoverSide = ref(null)
const hoverOnFixture = ref(false)

function onLineClick(event, side) {
  const rect = event.currentTarget.getBoundingClientRect()
  const pct = (event.clientX - rect.left) / rect.width
  const len = props.bar.length_cm || 600
  const rawCm = pct * len - len / 2
  const snapped = Math.round(rawCm / 10) * 10
  const half = len / 2
  const position = Math.max(-half, Math.min(half, snapped))
  emit('lineClick', { position, side })
}

let didDrag = false
function onFixtureClick(fx) {
  if (didDrag) { didDrag = false; return }
  emit('editFixture', fx)
}

// Drag (Fixture-Position auf der Linie verschieben)
let dragging = null
let dragBarLineEl = null

function onFixtureDragStart(e, fx) {
  const barEl = e.currentTarget.closest('[data-bar-id]')
  dragBarLineEl = barEl
  dragging = { fx, startX: e.clientX, startPos: fx.position }
  didDrag = false
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e) {
  if (!dragging || !dragBarLineEl) return
  const len = props.bar.length_cm
  const rect = dragBarLineEl.getBoundingClientRect()
  const dx = e.clientX - dragging.startX
  if (Math.abs(dx) > 3) didDrag = true
  const cmPerPx = len / rect.width
  const raw = dragging.startPos + dx * cmPerPx
  const snapped = Math.round(raw / 10) * 10
  const half = len / 2
  dragging.fx.position = Math.max(-half, Math.min(half, snapped))
}

function onDragEnd() {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  if (!dragging) return
  const { fx } = dragging
  dragging = null
  dragBarLineEl = null
  emit('fixtureDragEnd', fx)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
})
</script>

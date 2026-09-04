<template>
  <div class="relative flex flex-col h-full overflow-hidden bg-background text-foreground">
    <!-- Placement status banner -->
    <Transition name="placement-banner">
      <div v-if="pendingChannelForPlacement || pendingTowerForPlacement || pendingBarForPlacement" class="absolute top-0 right-0 z-30 flex items-center gap-3 px-4 py-2 bg-destructive text-white text-sm font-medium shadow-md">
        <span v-if="pendingChannelForPlacement">
          <span class="font-bold">{{ t('floorplan.place.channel', { channel: pendingChannelForPlacement.channel }) }}</span>
          <span v-if="pendingChannelForPlacement.device" class="opacity-80"> · {{ pendingChannelForPlacement.device }}</span>
          <span class="ml-2 opacity-90">{{ t('floorplan.place.click_or') }}</span>
          <kbd class="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/20 font-mono">ESC</kbd>
          <span class="opacity-90"> {{ t('floorplan.place.esc') }}</span>
        </span>
        <span v-else-if="pendingTowerForPlacement">
          <span class="font-bold">{{ t('floorplan.place.tower', { name: pendingTowerForPlacement.name }) }}</span>
          <span class="ml-2 opacity-90">{{ t('floorplan.place.click_or') }}</span>
          <kbd class="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/20 font-mono">ESC</kbd>
          <span class="opacity-90"> {{ t('floorplan.place.esc') }}</span>
        </span>
        <span v-else-if="pendingBarForPlacement">
          <span class="font-bold">{{ t('floorplan.place.bar', { name: pendingBarForPlacement.name }) }}</span>
          <span class="ml-2 opacity-90">{{ t('floorplan.place.click_or') }}</span>
          <kbd class="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/20 font-mono">ESC</kbd>
          <span class="opacity-90"> {{ t('floorplan.place.esc') }}</span>
        </span>
      </div>
    </Transition>
    <!-- Hintergrundbild-Ladefehler -->
    <div v-if="backgroundLoadError" class="absolute top-2 left-2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive text-white text-xs font-medium shadow-md">
      {{ t('error.generic') }}
    </div>
    <!-- Top Ribbon Toolbar -->
    <div class="bg-muted/30 border-b border-border flex items-stretch py-1.5 px-1 gap-1 z-10 shrink-0 overflow-x-auto">
      <!-- Gruppe: Navigation -->
      <div class="flex flex-col items-center gap-0.5 px-1.5">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide text-center">{{ t('floorplan.toolbar.group.navigate') }}</span>
        <div class="flex items-center gap-0.5">
          <SidebarBtn horizontal icon-only :active="activeTool === 'select'" :title="t('floorplan.tool.select.title')" @click="activeTool = 'select'">
            <MousePointer2 class="w-4 h-4 shrink-0" />
          </SidebarBtn>
          <SidebarBtn horizontal icon-only :active="activeTool === 'pan'" :title="t('floorplan.tool.pan.title')" @click="activeTool = 'pan'">
            <Hand class="w-4 h-4 shrink-0" />
          </SidebarBtn>
        </div>
      </div>
      <div class="w-px bg-border my-1 shrink-0"></div>

      <!-- Gruppe: Zeichnen -->
      <div class="flex flex-col items-center gap-0.5 px-1.5">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide text-center">{{ t('floorplan.toolbar.group.draw') }}</span>
        <div class="flex items-center gap-0.5">
          <SidebarBtn horizontal icon-only :active="activeTool === 'line'" :title="t('floorplan.tool.line.title')" @click="activeTool = 'line'">
            <Minus class="w-4 h-4 shrink-0 rotate-45" />
          </SidebarBtn>
          <SidebarBtn horizontal icon-only :active="activeTool === 'rect'" :title="t('floorplan.tool.rect.title')" @click="activeTool = 'rect'">
            <Square class="w-4 h-4 shrink-0" />
          </SidebarBtn>
          <SidebarBtn horizontal icon-only :active="activeTool === 'ellipse'" :title="t('floorplan.tool.ellipse.title')" @click="activeTool = 'ellipse'">
            <Circle class="w-4 h-4 shrink-0" />
          </SidebarBtn>
          <SidebarBtn horizontal icon-only :active="activeTool === 'text'" :title="t('floorplan.tool.text.title')" @click="activeTool = 'text'">
            <Type class="w-4 h-4 shrink-0" />
          </SidebarBtn>
        </div>
      </div>
      <div class="w-px bg-border my-1 shrink-0"></div>

      <!-- Gruppe: Lichttechnik -->
      <div class="flex flex-col items-center gap-0.5 px-1.5">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide text-center">{{ t('floorplan.toolbar.group.lighting') }}</span>
        <div class="flex items-stretch gap-0.5">
          <SidebarBtn horizontal icon-only :active="activeTool === 'channel' || activeTool === 'channel-pending'" :title="t('floorplan.tool.channel.title')" @click="openChannelPlacer">
            <CircleDot class="w-4 h-4 shrink-0" />
          </SidebarBtn>
          <SidebarBtn horizontal icon-only :active="activeTool === 'tower' || activeTool === 'tower-pending'" :title="t('floorplan.tool.tower.title')" @click="openTowerPlacer">
            <Layers class="w-4 h-4 shrink-0" />
          </SidebarBtn>
          <SidebarBtn horizontal icon-only :active="activeTool === 'bar' || activeTool === 'bar-pending'" :title="t('floorplan.tool.bar.title')" @click="openBarPlacer">
            <AlignJustify class="w-4 h-4 shrink-0" />
          </SidebarBtn>
        </div>
      </div>
      <div class="w-px bg-border my-1 shrink-0"></div>

      <!-- Gruppe: Maßstab -->
      <div class="flex flex-col items-center gap-0.5 px-1.5">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide text-center">{{ t('floorplan.toolbar.group.scale') }}</span>
        <div class="flex items-center gap-0.5">
          <SidebarBtn horizontal icon-only :active="activeTool === 'ruler'" :title="t('floorplan.tool.ruler.title')" @click="activeTool = 'ruler'">
            <Ruler class="w-4 h-4 shrink-0" />
          </SidebarBtn>
        </div>
      </div>
      <div class="w-px bg-border my-1 shrink-0"></div>

      <!-- Gruppe: Hintergrund -->
      <div class="flex flex-col items-center gap-0.5 px-1.5">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide text-center">{{ t('floorplan.toolbar.group.background') }}</span>
        <div class="flex items-center gap-0.5">
          <SidebarBtn horizontal icon-only :title="t('floorplan.image.upload.title')" @click="imageUploadInput?.click()">
            <Upload class="w-4 h-4 shrink-0" />
          </SidebarBtn>
          <SidebarBtn v-if="bgImageSrc" horizontal icon-only variant="danger" :title="t('floorplan.image.remove.title')" @click="emit('delete-image')">
            <ImageOff class="w-4 h-4 shrink-0" />
          </SidebarBtn>
          <input ref="imageUploadInput" type="file" accept="image/png,image/jpeg" class="hidden" @change="onImageFileSelected" />
        </div>
      </div>
      <div class="w-px bg-border my-1 shrink-0"></div>

      <!-- Gruppe: Export -->
      <div class="flex flex-col items-center gap-0.5 px-1.5">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide text-center">{{ t('floorplan.toolbar.group.export') }}</span>
        <div class="flex items-center gap-0.5">
          <SidebarBtn horizontal icon-only :title="t('floorplan.export.png.title')" @click="exportPNG">
            <Download class="w-4 h-4 shrink-0" />
          </SidebarBtn>
        </div>
      </div>
      <div class="w-px bg-border my-1 shrink-0 ml-auto"></div>

      <!-- Gruppe: Gitter -->
      <div class="flex flex-col items-center gap-0.5 px-1.5">
        <span class="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide text-center">{{ t('floorplan.toolbar.group.grid') }}</span>
        <div class="flex items-center gap-0.5">
          <button
            :class="['select-none font-medium transition-colors rounded-md h-9 px-2.5 text-xs', showGrid ? 'bg-accent/85 text-accent-foreground' : 'text-foreground hover:bg-muted']"
            :title="t('floorplan.grid.show.title')"
            @click="showGrid = !showGrid"
          >{{ t('floorplan.grid') }}</button>
          <button
            :class="['select-none font-medium transition-colors rounded-md h-9 px-2.5 text-xs', snapToGrid ? 'bg-accent/85 text-accent-foreground' : 'text-foreground hover:bg-muted']"
            :title="t('floorplan.grid.snap.title')"
            @click="snapToGrid = !snapToGrid"
          >{{ t('floorplan.snap') }}</button>
        </div>
      </div>
    </div>

    <div class="relative flex flex-1 min-h-0 overflow-hidden">
    <!-- Center Canvas -->
    <div
      ref="containerEl"
      class="flex-1 relative overflow-hidden"
      :class="(activeTool === 'pan' || spaceHeld) ? 'cursor-grab' : ['channel-pending', 'tower-pending', 'bar-pending'].includes(activeTool) ? 'cursor-none' : activeTool === 'ruler' ? 'cursor-crosshair' : activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'"
      :style="isPanning ? 'cursor:grabbing' : ''"
      @mousedown="onContainerMouseDown"
      @mousemove="onContainerMouseMove"
      @mouseup="onContainerMouseUp"
    >
      <div
        class="absolute origin-top-left" 
        :style="{ transform: `translate(${containerOffsetX}px, ${containerOffsetY}px) scale(${stageScale}) translate(${panOffset.x}px, ${panOffset.y}px)`, width: stageSize.width + 'px', height: stageSize.height + 'px' }"
      >
        <svg ref="svgRef" :width="stageSize.width" :height="stageSize.height" class="absolute inset-0 overflow-visible" style="user-select: none;">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#dc3740" />
            </marker>
          </defs>

          <!-- Background image -->
          <image v-if="bgImageSrc" id="bg-image" :href="bgImageSrc" x="0" y="0" :width="stageSize.width" :height="stageSize.height" preserveAspectRatio="xMidYMid meet" style="pointer-events: none;" />

          <!-- Grid -->
          <g v-if="showGrid" stroke="rgba(100,100,100,0.3)" stroke-width="1" style="pointer-events: none;">
            <line v-for="x in gridVerticalLines" :key="'gv'+x" :x1="x" :y1="gridTop" :x2="x" :y2="gridBottom" />
            <line v-for="y in gridHorizontalLines" :key="'gh'+y" :x1="gridLeft" :y1="y" :x2="gridRight" :y2="y" />
          </g>

          <!-- A4-Querformat Druckbereich (Guide) -->
          <g style="pointer-events: none;">
            <path :d="a4GuideMaskPath" fill="rgba(0,0,0,0.45)" fill-rule="evenodd" />
            <rect :x="a4Guide.x" :y="a4Guide.y" :width="a4Guide.w" :height="a4Guide.h" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="8,5" opacity="0.85" />
          </g>

          <!-- Elements -->
          <g v-for="el in elements" :key="el.id" :transform="getTransform(el)" @mousedown="onNodeMouseDown(el.id, $event)" @dblclick.stop="onNodeDblClick(el.id)" @mouseenter="hoveredId = el.id; showTooltip(el, $event)" @mouseleave="hoveredId = null; hideTooltip()" @mousemove="showTooltip(el, $event)">
            <!-- Highlight when selected -->
            <rect v-if="selectedIds.has(el.id) && el.type !== 'line' && el.type !== 'channel'"
                  :x="getBounds(el).x" :y="getBounds(el).y" :width="getBounds(el).w" :height="getBounds(el).h"
                  fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,4" />

            <!-- Line -->
            <line v-if="el.type === 'line'" :x1="el.x1" :y1="el.y1" :x2="el.x2" :y2="el.y2" 
                  :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" />
            <!-- Line selection box / invisible hit area -->
            <line v-if="el.type === 'line'" :x1="el.x1" :y1="el.y1" :x2="el.x2" :y2="el.y2" stroke="transparent" stroke-width="16" style="cursor: pointer;" />
            
            <circle v-if="selectedIds.has(el.id) && el.type === 'line'" :cx="el.x1" :cy="el.y1" r="5" fill="#f59e0b" cursor="pointer" @mousedown.stop="startResizeLine(el.id, 1, $event)" />
            <circle v-if="selectedIds.has(el.id) && el.type === 'line'" :cx="el.x2" :cy="el.y2" r="5" fill="#f59e0b" cursor="pointer" @mousedown.stop="startResizeLine(el.id, 2, $event)" />

            <!-- Rect -->
            <rect v-else-if="el.type === 'rect'" :x="el.x" :y="el.y" :width="el.w" :height="el.h" 
                  :fill="el.fill || 'transparent'" :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" style="cursor: pointer;" />

            <!-- Ellipse -->
            <ellipse v-else-if="el.type === 'ellipse'" :cx="el.x" :cy="el.y" :rx="el.rx" :ry="el.ry" 
                     :fill="el.fill || 'transparent'" :stroke="el.color || '#6b7280'" :stroke-width="el.strokeWidth || 2" style="cursor: pointer;" />

            <!-- Text -->
            <text v-else-if="el.type === 'text'" :x="el.x" :y="el.y" :fill="el.color || '#9ca3af'" 
                  :font-size="el.fontSize || 16" :font-weight="el.fontStyle === 'bold' ? 'bold' : 'normal'" 
                  dominant-baseline="hanging" style="cursor: pointer;">{{ el.text }}</text>

            <!-- Tower Node -->
            <g v-else-if="el.type === 'tower'" style="cursor: pointer;" @dblclick.stop="emit('open-tower', el.towerId)">
              <rect :x="el.x" :y="el.y" :width="el.w || 120" :height="el.h || 70" rx="6"
                    fill="var(--color-accent)"
                    :fill-opacity="selectedIds.has(el.id) ? 1 : 0.45"
                    :stroke="selectedIds.has(el.id) ? 'var(--color-ring)' : 'var(--color-accent)'"
                    stroke-width="2" />
              <!-- Side badge -->
              <rect v-if="towerForEl(el)?.side" :x="el.x + (el.w || 120) - 22" :y="el.y + 5" width="17" height="15" rx="3" fill="var(--color-accent)" />
              <text v-if="towerForEl(el)?.side" :x="el.x + (el.w || 120) - 13.5" :y="el.y + 12.5" fill="var(--color-accent-foreground)" :font-size="'var(--text-xs)'" font-weight="bold" text-anchor="middle" dominant-baseline="middle">{{ towerForEl(el)?.side }}</text>
              <!-- Name -->
              <text :x="el.x + (el.w || 120) / 2" :y="el.y + (el.h || 70) / 2 - 11" fill="var(--color-foreground)" font-size="18" font-weight="700" text-anchor="middle" dominant-baseline="middle">{{ (towerForEl(el)?.name || el.towerName || 'Turm').slice(0, 11) }}</text>
              <!-- Kreisnummern der belegten Slots -->
              <text v-if="towerChannels(towerForEl(el) || {}).length" :x="el.x + (el.w || 120) / 2" :y="el.y + (el.h || 70) / 2 + 13" fill="var(--color-foreground)" font-size="18" font-weight="600" text-anchor="middle" dominant-baseline="middle">{{ towerChannels(towerForEl(el) || {}).join(', ') }}</text>
            </g>

            <!-- Bar Node -->
            <g v-else-if="el.type === 'bar'" style="cursor: pointer;">
              <!-- Background rect for selection -->
              <rect :x="el.x" :y="el.y" :width="el.w || 160" :height="el.h || 28" rx="4"
                    :fill="selectedIds.has(el.id) ? 'rgba(251,191,36,0.08)' : 'rgba(16,185,129,0.06)'"
                    :stroke="selectedIds.has(el.id) ? '#f59e0b' : 'rgba(16,185,129,0.3)'"
                    stroke-width="1" stroke-dasharray="4,2" />
              <!-- Main bar line -->
              <line :x1="el.x" :y1="el.y + (el.h || 28) / 2" :x2="el.x + (el.w || 160)" :y2="el.y + (el.h || 28) / 2"
                    :stroke="selectedIds.has(el.id) ? '#f59e0b' : '#10b981'" stroke-width="5" stroke-linecap="round" />
              <!-- Name label -->
              <text :x="el.x + 4" :y="el.y - 6" fill="#6ee7b7" font-size="18" font-weight="600" dominant-baseline="auto">{{ barForEl(el)?.name || el.barName || 'Stange' }}</text>
              <!-- Fixture pins -->
              <g v-for="fx in (barForEl(el)?.fixtures ?? [])" :key="fx.channel_id">
                <circle
                  :cx="el.x + fixtureXOffset(fx.position, barForEl(el)?.length_cm, el.w || 160)"
                  :cy="el.y + (el.h || 28) / 2"
                  r="22"
                  fill="#dc3740"
                  stroke="rgba(220,55,64,0.4)"
                  stroke-width="3"
                />
                <text
                  :x="el.x + fixtureXOffset(fx.position, barForEl(el)?.length_cm, el.w || 160)"
                  :y="el.y + (el.h || 28) / 2"
                  fill="white" font-size="18" font-weight="700" text-anchor="middle" dominant-baseline="central"
                >{{ channelNrById(fx.channel_id) }}</text>
              </g>
            </g>

            <!-- Channel -->
            <g v-else-if="el.type === 'channel'" style="cursor: pointer;">
              <!-- Selection indicator -->
              <rect v-if="selectedIds.has(el.id)" :x="-pillW(el.channel)/2 - 4" :y="-22" :width="pillW(el.channel) + 8" :height="44" rx="22" fill="none" stroke="#dc3740" stroke-width="2" stroke-dasharray="4,3" />
              <!-- Arrow (nur wenn kein noArrow-Flag) -->
              <line v-if="!el.noArrow"
                    :x1="getArrowPoints(el.channel, el.rotation).x1" :y1="getArrowPoints(el.channel, el.rotation).y1"
                    :x2="getArrowPoints(el.channel, el.rotation).x2" :y2="getArrowPoints(el.channel, el.rotation).y2"
                    stroke="#dc3740" stroke-width="3" marker-end="url(#arrowhead)" />
              <!-- Pill -->
              <rect :x="-pillW(el.channel)/2" :y="-CHANNEL_PILL_RADIUS" :width="pillW(el.channel)" :height="CHANNEL_PILL_RADIUS * 2" :rx="CHANNEL_PILL_RADIUS" fill="#dc3740" stroke="#dc3740" stroke-width="2" />
              <!-- Text -->
              <text x="0" y="0" fill="#fff" font-size="18" font-weight="bold" text-anchor="middle" dominant-baseline="central">{{ el.channel }}</text>
              <!-- Rotation handle at arrow tip (nur wenn Pfeil vorhanden) -->
              <circle
                v-if="!el.noArrow && (hoveredId === el.id || selectedIds.has(el.id))"
                :cx="getArrowPoints(el.channel, el.rotation).x2"
                :cy="getArrowPoints(el.channel, el.rotation).y2"
                r="7"
                fill="white"
                stroke="#dc3740"
                stroke-width="2"
                cursor="grab"
                @mousedown.stop="startArrowRotateDrag(el, $event)"
              />
            </g>

            <!-- Resize handle for rect/ellipse -->
            <circle v-if="selectedIds.has(el.id) && ['rect', 'ellipse'].includes(el.type)"
                    :cx="getBounds(el).x + getBounds(el).w" :cy="getBounds(el).y + getBounds(el).h" 
                    r="5" fill="#f59e0b" cursor="nwse-resize" @mousedown.stop="startResizeRectEllipse(el.id, $event)" />
          </g>

          <!-- Preview shape -->
          <line v-if="preview && activeTool === 'line'" :x1="preview.x1" :y1="preview.y1" :x2="preview.x2" :y2="preview.y2" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" />
          <rect v-if="preview && activeTool === 'rect'" :x="preview.x" :y="preview.y" :width="preview.w" :height="preview.h" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" fill="transparent" />
          <ellipse v-if="preview && activeTool === 'ellipse'" :cx="preview.cx" :cy="preview.cy" :rx="preview.rx" :ry="preview.ry" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" fill="transparent" />

          <!-- Lasso Rect -->
          <rect v-if="lassoRect" :x="lassoRect.x" :y="lassoRect.y" :width="lassoRect.w" :height="lassoRect.h" fill="rgba(59,130,246,0.08)" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2,3" />

          <!-- Ruler calibration preview -->
          <g v-if="activeTool === 'ruler' && rulerPoints.length > 0" style="pointer-events:none;">
            <circle :cx="rulerPoints[0].x" :cy="rulerPoints[0].y" r="5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
            <line v-if="rulerPoints.length === 2"
              :x1="rulerPoints[0].x" :y1="rulerPoints[0].y"
              :x2="rulerPoints[1].x" :y2="rulerPoints[1].y"
              stroke="#f59e0b" stroke-width="2" stroke-dasharray="6,4" />
            <circle v-if="rulerPoints.length === 2" :cx="rulerPoints[1].x" :cy="rulerPoints[1].y" r="5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
          </g>

          <!-- Scale bar -->
          <g v-if="scalePixelsPerMeter > 0" style="pointer-events:none;" :transform="`translate(${-panOffset.x + 16}, ${stageSize.height - panOffset.y - 28})`">
            <rect x="-4" y="-16" :width="scaleBarWidth + 8" height="28" rx="4" fill="rgba(0,0,0,0.5)" />
            <text :x="scaleBarWidth / 2" y="-5" fill="white" font-size="9" font-weight="600" text-anchor="middle" dominant-baseline="auto">{{ scaleBarLabel }}</text>
            <line x1="0" y1="6" :x2="scaleBarWidth" y2="6" stroke="white" stroke-width="2" stroke-linecap="round" />
            <line x1="0" y1="2" x2="0" y2="10" stroke="white" stroke-width="1.5" />
            <line :x1="scaleBarWidth" y1="2" :x2="scaleBarWidth" y2="10" stroke="white" stroke-width="1.5" />
          </g>

          <!-- Notes -->
          <g v-for="el in elementsWithNotes" :key="'note-'+el.id" style="pointer-events: none;">
            <!-- connector line from element anchor to label -->
            <line
              :x1="el._anchorX" :y1="el._anchorY"
              :x2="el._noteX" :y2="el._noteY + 10"
              stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,3" opacity="0.7"
            />
            <!-- anchor dot on element -->
            <circle :cx="el._anchorX" :cy="el._anchorY" r="3" fill="#f59e0b" opacity="0.9" />
            <!-- label pill -->
            <g :transform="`translate(${el._noteX}, ${el._noteY})`">
              <rect
                :x="-(noteTextWidth(el.notes) / 2)"
                y="0"
                :width="noteTextWidth(el.notes)"
                height="22"
                rx="11"
                fill="#1c1c24"
                stroke="#f59e0b"
                stroke-width="1"
                opacity="0.95"
              />
              <text
                x="0"
                y="14"
                fill="#f5d78e"
                font-size="10.5"
                font-weight="600"
                font-family="ui-sans-serif,system-ui,sans-serif"
                text-anchor="middle"
                dominant-baseline="auto"
                letter-spacing="0.03em"
              >{{ el.notes }}</text>
            </g>
          </g>
        </svg>
      </div>

      <!-- Empty State -->
      <div v-if="!bgImageSrc && elements.length === 0" class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8 pointer-events-none -mt-5">
        <Layers class="size-8 text-muted-foreground/40" />
        <div class="max-w-100 pointer-events-auto select-text">
          <p class="text-base font-medium text-foreground/70">{{ t('floorplan.empty') }}</p>
          <p class="text-sm text-muted-foreground mt-1">{{ t('floorplan.empty.desc') }}</p>
        </div>
        <Button variant="accent" class="pointer-events-auto mt-1 rounded-full shadow-lg" @click="imageUploadInput?.click()">
          <Upload class="size-4" />{{ t('floorplan.image.upload') }}
        </Button>
      </div>

      <!-- Hover Tooltip -->
      <div
        v-if="tooltip.visible"
        class="absolute z-50 pointer-events-none"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px', transform: 'translate(-50%, -100%) translateY(-8px)' }"
      >
        <div class="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg px-3 py-2 text-sm max-w-55">
          <div class="font-bold text-foreground">{{ tooltip.title }}</div>
          <div v-if="tooltip.sub" class="text-muted-foreground text-xs mt-0.5">{{ tooltip.sub }}</div>
          <div v-if="tooltip.channels?.length" class="flex flex-wrap gap-1 mt-1.5">
            <span v-for="ch in tooltip.channels" :key="ch" class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-destructive text-white font-bold text-xs">{{ ch }}</span>
          </div>
        </div>
        <div class="w-2 h-2 bg-popover border-b border-r border-border rotate-45 mx-auto -mt-1"></div>
      </div>

      <!-- Ghost cursor for channel placement -->
      <div
        v-if="activeTool === 'channel-pending' && ghostPos && pendingChannelForPlacement"
        class="absolute pointer-events-none z-40"
        :style="{ left: ghostPos.x + 'px', top: ghostPos.y + 'px', transform: 'translate(-50%, -50%)' }"
      >
        <svg width="80" height="40" viewBox="-40 -20 80 40" style="overflow: visible;">
          <rect x="-31" :y="-CHANNEL_PILL_RADIUS" width="62" :height="CHANNEL_PILL_RADIUS * 2" :rx="CHANNEL_PILL_RADIUS" fill="#dc3740" opacity="0.85" />
          <text x="0" y="0" fill="#fff" font-size="18" font-weight="bold" text-anchor="middle" dominant-baseline="central">{{ pendingChannelForPlacement.channel }}</text>
        </svg>
      </div>

      <!-- Ghost cursor for tower placement -->
      <div
        v-if="activeTool === 'tower-pending' && ghostPos && pendingTowerForPlacement"
        class="absolute pointer-events-none z-40"
        :style="{ left: ghostPos.x + 'px', top: ghostPos.y + 'px', transform: 'translate(-50%, -50%)' }"
      >
        <svg width="120" height="70" viewBox="0 0 120 70" style="overflow: visible;">
          <rect x="0" y="0" width="120" height="70" rx="6" fill="var(--color-accent)" fill-opacity="0.45" stroke="var(--color-accent)" stroke-width="2" opacity="0.85" />
          <text x="60" y="35" fill="var(--color-foreground)" font-size="13" font-weight="700" text-anchor="middle" dominant-baseline="middle">{{ (pendingTowerForPlacement.name || '').slice(0, 11) }}</text>
        </svg>
      </div>

      <!-- Ghost cursor for bar placement -->
      <div
        v-if="activeTool === 'bar-pending' && ghostPos && pendingBarForPlacement"
        class="absolute pointer-events-none z-40"
        :style="{ left: ghostPos.x + 'px', top: ghostPos.y + 'px', transform: 'translate(-50%, -50%)' }"
      >
        <svg :width="ghostBarWidth" height="28" :viewBox="`0 0 ${ghostBarWidth} 28`" style="overflow: visible;">
          <rect x="0" y="0" :width="ghostBarWidth" height="28" rx="4" fill="rgba(16,185,129,0.06)" stroke="#10b981" stroke-width="1" stroke-dasharray="4,2" opacity="0.9" />
          <line x1="0" y1="14" :x2="ghostBarWidth" y2="14" stroke="#10b981" stroke-width="5" stroke-linecap="round" opacity="0.85" />
          <text :x="ghostBarWidth / 2" y="-6" fill="#6ee7b7" font-size="10" font-weight="600" text-anchor="middle">{{ pendingBarForPlacement.name }}</text>
        </svg>
      </div>

      <!-- Inline Text Editor -->
      <textarea
        v-if="textEditNode"
        ref="textareaRef"
        v-model="textEditValue"
        class="absolute z-30 bg-popover/90 border border-primary text-popover-foreground p-1 resize-none outline-none rounded text-sm shadow-md"
        :style="textEditStyle"
        @blur="commitTextEdit"
        @keydown.enter.prevent="commitTextEdit"
        @keydown.escape="cancelTextEdit"
      />

    <!-- Bottom Properties Panel -->
    <Transition name="props-panel">
      <div
        v-if="selectedIds.size > 0"
        class="absolute bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur border-t border-border flex items-center gap-4 px-4 py-2 min-h-[52px]"
        @mousedown.stop
      >
        <!-- Titel / Typ -->
        <div class="shrink-0 min-w-[90px]">
          <div class="text-xs text-muted-foreground uppercase tracking-wider font-semibold leading-none mb-0.5">
            <template v-if="selectedIds.size > 1">{{ selectedIds.size }} Elemente</template>
            <template v-else-if="selectedElement">{{ typeLabel(selectedElement.type) }}</template>
          </div>
          <div v-if="selectedIds.size === 1 && selectedElement" class="text-sm font-medium truncate max-w-[120px]">
            <template v-if="selectedElement.type === 'channel'">Kanal {{ selectedElement.channel }}</template>
            <template v-else-if="selectedElement.type === 'tower'">{{ towerForEl(selectedElement)?.name || '–' }}</template>
            <template v-else-if="selectedElement.type === 'bar'">{{ barForEl(selectedElement)?.name || '–' }}</template>
          </div>
        </div>

        <div class="w-px h-8 bg-border shrink-0"></div>

        <!-- Element-spezifische Controls -->
        <div v-if="selectedIds.size === 1 && selectedElement" class="flex items-center gap-3 flex-wrap flex-1 min-w-0">

          <!-- Linie / Rect / Ellipse: Farbe + Stärke -->
          <template v-if="['line','rect','ellipse'].includes(selectedElement.type)">
            <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
              Kontur
              <input type="color" :value="selectedElement.color || '#6b7280'" @input="e => { selectedElement.color = e.target.value; emitChange() }" class="w-7 h-7 rounded cursor-pointer bg-transparent border border-border p-0.5" />
            </label>
            <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
              Stärke
              <Input v-model.number="selectedElement.strokeWidth" type="number" min="1" max="20" class="w-14 h-7 text-xs px-2" @input="emitChange" />
            </label>
            <template v-if="selectedElement.type !== 'line'">
              <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                Füllung
                <input v-if="selectedElement.fill && selectedElement.fill !== 'transparent'" type="color" :value="selectedElement.fill" @input="e => { selectedElement.fill = e.target.value; emitChange() }" class="w-7 h-7 rounded cursor-pointer bg-transparent border border-border p-0.5" />
              </label>
              <Button variant="outline" size="sm" class="h-7 px-2 text-xs" @click="toggleFill(selectedElement)">
                {{ selectedElement.fill && selectedElement.fill !== 'transparent' ? 'Transparent' : 'Füllen' }}
              </Button>
            </template>
          </template>

          <!-- Text -->
          <template v-if="selectedElement.type === 'text'">
            <Input v-model="selectedElement.text" type="text" placeholder="Text…" class="h-7 text-sm w-40" @input="emitChange" />
            <Input v-model.number="selectedElement.fontSize" type="number" min="6" max="200" class="w-14 h-7 text-xs px-2" @input="emitChange" />
            <Button size="sm" class="h-7 px-2 font-bold" :variant="selectedElement.fontStyle === 'bold' ? 'default' : 'ghost'" @click="toggleFontStyle(selectedElement)">B</Button>
            <input type="color" :value="selectedElement.color || '#9ca3af'" @input="e => { selectedElement.color = e.target.value; emitChange() }" class="w-7 h-7 rounded cursor-pointer bg-transparent border border-border p-0.5" />
          </template>

          <!-- Kanal -->
          <template v-if="selectedElement.type === 'channel'">
            <div v-if="channelInfo" class="flex items-center gap-2 text-sm text-muted-foreground">
              <span v-if="channelInfo.device">{{ channelInfo.device }}</span>
              <span v-if="channelInfo.position" class="opacity-60">· {{ channelInfo.position }}</span>
            </div>
            <Button size="sm" variant="outline" class="h-7 px-2 text-xs" @click="toggleNoArrow(selectedElement)">
              {{ selectedElement.noArrow ? 'Pfeil hinzufügen' : 'Pfeil entfernen' }}
            </Button>
            <Button size="sm" variant="outline" class="h-7 px-2 text-xs" @click="jumpToChannel">→ Zum Kanal</Button>
          </template>

          <!-- Tower -->
          <template v-if="selectedElement.type === 'tower'">
            <div class="text-sm text-muted-foreground">{{ filledSlotsLabel(selectedElement) }}</div>
            <div class="flex gap-1 flex-wrap">
              <span v-for="slot in (towerForEl(selectedElement)?.slots ?? []).filter(s => s.channel_id)" :key="slot.id"
                class="flex items-center justify-center w-7 h-7 rounded-full bg-destructive text-white font-bold text-xs">
                {{ props.channels.find(c => c.id === slot.channel_id)?.channel ?? '?' }}
              </span>
            </div>
            <Button size="sm" variant="outline" class="h-7 px-2 text-xs" @click="emit('open-tower', selectedElement.towerId)">→ Beleuchtungsgestell</Button>
          </template>

          <!-- Bar -->
          <template v-if="selectedElement.type === 'bar'">
            <div class="text-sm text-muted-foreground">{{ fixturesLabel(selectedElement) }}</div>
            <div class="flex gap-1 flex-wrap">
              <span v-for="fixture in (barForEl(selectedElement)?.fixtures ?? [])" :key="fixture.id"
                class="flex items-center justify-center w-7 h-7 rounded-full bg-destructive text-white font-bold text-xs">
                {{ channelNrById(fixture.channel_id) }}
              </span>
            </div>
            <Button size="sm" variant="outline" class="h-7 px-2 text-xs" @click="emit('open-bar', selectedElement.barId)">→ Zugstange</Button>
          </template>

          <!-- Notiz (für alle außer Text und Tower) -->
          <template v-if="!['text','tower'].includes(selectedElement.type)">
            <div class="w-px h-8 bg-border shrink-0"></div>
            <input
              v-model="selectedElement.notes"
              type="text"
              placeholder="Notiz…"
              class="h-7 text-xs bg-transparent border border-input rounded-md px-2 w-36 placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring"
              @input="emitChange"
            />
          </template>

          <!-- Duplizieren (für einfache Shapes) -->
          <template v-if="['line','rect','ellipse','text'].includes(selectedElement.type)">
            <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="duplicateSelected">
              <Copy class="size-3 mr-1" />Duplizieren
            </Button>
          </template>
        </div>

        <!-- Multi-select -->
        <div v-else-if="selectedIds.size > 1" class="flex items-center gap-2 flex-1">
          <span class="text-sm text-muted-foreground">{{ selectedIds.size }} Elemente ausgewählt</span>
        </div>

        <div class="ml-auto shrink-0 flex items-center gap-2">
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" @click="deleteSelected">
            <Trash2 class="size-3 mr-1" />Löschen
          </Button>
          <button class="text-muted-foreground hover:text-foreground p-1 rounded" @click="selectedIds = new Set()">
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Transition>

    </div><!-- /Center Canvas -->
    </div><!-- /flex row wrapper -->

    <!-- Tower Picker Dialog -->
    <Dialog :open="showTowerPicker" @update:open="val => { if (!val) showTowerPicker = false }">
      <DialogContent class="sm:max-w-lg flex flex-col max-h-[80vh]">
        <DialogHeader><DialogTitle>{{ t('floorplan.tower.title') }}</DialogTitle></DialogHeader>
        <DialogBody class="flex-1 overflow-y-auto">
          <div class="flex flex-col gap-2">
            <Input v-model="towerSearch" :placeholder="t('action.search')" autofocus />
            <div class="w-full max-h-96 overflow-y-auto grid! gap-2 pt-1" style="grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));">
              <button
                v-for="tower in filteredTowers" :key="tower.id" type="button"
                :disabled="towerAlreadyPlaced(tower.id)"
                @click="placeTowerNode(tower)"
                class="rounded-lg border border-border bg-card flex flex-col items-start justify-center gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/15 hover:border-accent/50"
                :class="towerAlreadyPlaced(tower.id) && 'opacity-40 pointer-events-none'"
              >
                <span class="font-bold text-sm">{{ tower.name }}</span>
                <span class="text-xs text-muted-foreground">{{ tower.side || '' }}</span>
                <span v-if="towerChannels(tower).length" class="text-xs text-muted-foreground/70 font-mono truncate w-full">{{ towerChannels(tower).join(', ') }}</span>
              </button>
              <div v-if="!filteredTowers.length" class="col-span-full text-xs text-muted-foreground px-2 py-4 text-center">{{ t('floorplan.tower.empty') }}</div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter><Button variant="outline" @click="showTowerPicker = false">{{ t('action.cancel') }}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Bar Picker Dialog -->
    <Dialog :open="showBarPicker" @update:open="val => { if (!val) showBarPicker = false }">
      <DialogContent class="sm:max-w-lg flex flex-col max-h-[80vh]">
        <DialogHeader><DialogTitle>{{ t('floorplan.bar.title') }}</DialogTitle></DialogHeader>
        <DialogBody class="flex-1 overflow-y-auto">
          <div class="flex flex-col gap-2">
            <Input v-model="barSearch" :placeholder="t('action.search')" autofocus />
            <div class="w-full max-h-96 overflow-y-auto grid! gap-2 pt-1" style="grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));">
              <button
                v-for="bar in filteredBars" :key="bar.id" type="button"
                :disabled="barAlreadyPlaced(bar.id)"
                @click="placeBarNode(bar)"
                class="rounded-lg border border-border bg-card flex flex-col items-start justify-center gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/15 hover:border-accent/50"
                :class="barAlreadyPlaced(bar.id) && 'opacity-40 pointer-events-none'"
              >
                <span class="font-bold text-sm">{{ bar.name }}</span>
                <span class="text-xs text-muted-foreground">{{ formatLength(bar.length_cm) }}{{ bar.zug_nr ? ' · Zug ' + bar.zug_nr : '' }}</span>
                <span v-if="barChannels(bar).length" class="text-xs text-muted-foreground/70 font-mono truncate w-full">{{ barChannels(bar).join(', ') }}</span>
              </button>
              <div v-if="!filteredBars.length" class="col-span-full text-xs text-muted-foreground px-2 py-4 text-center">{{ t('floorplan.bar.empty') }}</div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter><Button variant="outline" @click="showBarPicker = false">{{ t('action.cancel') }}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Ruler Distance Dialog -->
    <Dialog :open="showRulerDialog" @update:open="val => { if (!val) cancelRuler() }">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader><DialogTitle>{{ t('floorplan.ruler.title') }}</DialogTitle></DialogHeader>
        <DialogBody>
          <p class="text-sm text-muted-foreground mb-1">{{ t('floorplan.ruler.hint') }}</p>
          <p class="text-xs text-muted-foreground/70 mb-3">{{ t('floorplan.ruler.purpose') }}</p>
          <Input v-model="rulerDistanceInput" type="text" inputmode="decimal" :placeholder="t('floorplan.ruler.placeholder')" autofocus @keydown.enter="commitRuler" />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" @click="cancelRuler">{{ t('action.cancel') }}</Button>
          <Button @click="commitRuler">{{ t('floorplan.ruler.confirm') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Channel Picker Dialog -->
    <Dialog :open="showChannelPicker" @update:open="val => { if (!val) showChannelPicker = false }">
      <DialogContent class="sm:max-w-2xl flex flex-col max-h-[80vh]">
        <DialogHeader><DialogTitle>{{ t('floorplan.channel.title') }}</DialogTitle></DialogHeader>
        <DialogBody class="flex-1 overflow-y-auto">
          <ChannelPickerGrid :channels="props.channels" :model-value="[]" v-model:search="channelSearch" :search-placeholder="t('action.search')" @pick="placeChannelCircle" @enter="placeChannelCircle" />
        </DialogBody>
        <DialogFooter><Button variant="outline" @click="showChannelPicker = false">{{ t('action.cancel') }}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { useMeasureUnit } from '@/composables/useMeasureUnit'
const { t } = useLocale()
const { formatLength } = useMeasureUnit()
import { getToken } from '@/api/client'
import { uuid } from '../utils/uuid.js'
import { exportFloorplanPNG } from '../utils/floorplanSnapshot.js'
import { ELEMENT_TYPES, getElementLabel, getElementBounds, getElementCenter, getNoteAnchor, elementHasEndpoints } from '../utils/floorplanElementTypes'
import { useCanvasViewport } from '@/composables/floorplan/useCanvasViewport'
import { useElementPicker } from '@/composables/floorplan/useElementPicker'
import { useEditorClipboard } from '@/composables/floorplan/useEditorClipboard'
import { useRulerCalibration } from '@/composables/floorplan/useRulerCalibration'
import { useInlineTextEdit } from '@/composables/floorplan/useInlineTextEdit'
import { useElementDragResize } from '@/composables/floorplan/useElementDragResize'
import { PDF_PRINT_AREA_RATIO } from '@shared/constants.js'
import {
  Copy, MousePointer2, Hand, Minus, Square, Circle, Type, CircleDot,
  Upload, ImageOff, Download, Trash2, Layers, AlignJustify, Ruler,
  X
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import ChannelPickerGrid from './show/ChannelPickerGrid.vue'
import SidebarBtn from '@/components/ui/SidebarBtn.vue'

const props = defineProps({
  imageUrl: { type: String, default: null },
  initialCanvasData: { type: String, default: null },
  channels: { type: Array, default: () => [] },
  towers: { type: Array, default: () => [] },
  bars: { type: Array, default: () => [] },
  pendingChannel: { type: Object, default: null },
})
const emit = defineEmits(['change', 'jump-to-channel', 'upload-image', 'delete-image', 'open-tower', 'open-bar'])

const activeTool = ref('select')
const elements = ref([])
const selectedIds = ref(new Set())
const preview = ref(null)
const drawStart = ref(null)
const {
  showChannelPicker, channelPickerPos, channelSearch,
  showTowerPicker, towerPickerPos, towerSearch,
  showBarPicker, barPickerPos, barSearch,
  pendingChannelForPlacement, pendingTowerForPlacement, pendingBarForPlacement, ghostPos,
  filteredTowers, filteredBars,
  openChannelPlacer: openChannelPlacerAt, openTowerPlacer: openTowerPlacerAt, openBarPlacer: openBarPlacerAt,
  placeTowerNode: pickTowerNode, placeBarNode: pickBarNode,
  clearPending: clearPendingPlacement,
} = useElementPicker(() => props.towers, () => props.bars)
const ghostBarWidth = computed(() => barWidthPx(pendingBarForPlacement.value?.length_cm || 600))
function towerChannels(tower) {
  return (tower.slots ?? [])
    .filter(slot => slot.channel_id)
    .sort((a, b) => a.slot_index - b.slot_index)
    .map(slot => channelNrById(slot.channel_id, null))
    .filter(Boolean)
}
function barChannels(bar) {
  return (bar.fixtures ?? [])
    .filter(fx => fx.channel_id)
    .map(fx => channelNrById(fx.channel_id, null))
    .filter(Boolean)
}
const svgRef = ref(null)
const containerEl = ref(null)
const imageUploadInput = ref(null)
const lassoRect = ref(null)
const pendingDirectionId = ref(null)

const bgImage = ref(null)
const bgImageSrc = ref('')
const backgroundLoadError = ref(false)
// Objekt-URL des aktuell angezeigten Hintergrundbilds — nicht reaktiv, dient nur der
// Buchführung, damit loadBackground() sie vor dem nächsten Laden/beim Unmount freigeben kann.
let activeBlobUrl = null
function revokeActiveBlobUrl() {
  if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); activeBlobUrl = null }
}

const {
  containerSize, stageSize, stageScale, containerOffsetX, containerOffsetY,
  showGrid, snapToGrid, panOffset, isPanning, spaceHeld,
  gridLeft, gridTop, gridRight, gridBottom, gridVerticalLines, gridHorizontalLines,
  snap, fitToContainer, resetView: resetViewport, startPan, updatePan, endPan,
} = useCanvasViewport(containerEl)

// PDF_PRINT_AREA_RATIO: siehe shared/constants.js — Druckbereich im PDF-Export
// (A4 quer, minus Seitenränder/Titel/Fußzeile, siehe server/pdf.js), muss mit
// server/pdf/floorplan-vector.js übereinstimmen.
// Radius der Kanal-Pille (Node + Ghost-Cursor-Vorschau) — auch für getArrowPoints()
// maßgeblich, wo entlang des Pillenrands der Richtungspfeil ansetzt.
const CHANNEL_PILL_RADIUS = 18
const a4Guide = computed(() => {
  const { width: sw, height: sh } = stageSize.value
  let w = sw, h = sw / PDF_PRINT_AREA_RATIO
  if (h > sh) { h = sh; w = sh * PDF_PRINT_AREA_RATIO }
  return { x: Math.round((sw - w) / 2), y: Math.round((sh - h) / 2), w: Math.round(w), h: Math.round(h) }
})
const a4GuideMaskPath = computed(() => {
  const { width: sw, height: sh } = stageSize.value
  const g = a4Guide.value
  return `M0,0 H${sw} V${sh} H0 Z M${g.x},${g.y} H${g.x + g.w} V${g.y + g.h} H${g.x} Z`
})

const { copySelected, pasteClipboard, duplicateSelected } = useEditorClipboard(elements, selectedIds, uuid, emitChange)
const {
  textEditNode, textEditValue, textEditStyle, textareaRef,
  beginTextEdit, commitTextEdit, cancelTextEdit,
} = useInlineTextEdit((id, text) => {
  const el = elements.value.find(e => e.id === id)
  if (el) { el.text = text; emitChange() }
})
const {
  isElementDragging, elementWasDragged, isResizing, isArrowRotating, dragStartSnapshot,
  beginElementDrag, startResizeLine, startResizeRectEllipse,
  applyResizeMove, applyDragMove, finishResize, finishDrag,
  updateRotation, startRotationDrag, startArrowRotateDrag,
} = useElementDragResize(elements, selectedIds, snap, emitChange, getPointerPos)

const selectedId = computed(() => selectedIds.value.size === 1 ? [...selectedIds.value][0] : null)
const selectedElement = computed(() => elements.value.find(e => e.id === selectedId.value))
const channelInfo = computed(() => {
  if (!selectedElement.value || selectedElement.value.type !== 'channel') return null
  return props.channels.find(ch => ch.channel === selectedElement.value.channel)
})

const NOTE_LABEL_GAP = 22
const elementsWithNotes = computed(() => {
  return elements.value.filter(el => el.type !== 'text' && el.notes && el.notes.trim()).map(el => {
    // _anchorX/Y: point on the element border where the line starts
    // _noteX/Y: center of the pill label
    const { x: ax, y: ay } = getNoteAnchor(el)
    return { ...el, _anchorX: ax, _anchorY: ay, _noteX: ax, _noteY: ay + NOTE_LABEL_GAP }
  })
})

const hoveredId = ref(null)
const tooltip = ref({ visible: false, x: 0, y: 0, title: '', sub: '', channels: [] })

function showTooltip(el, e) {
  if (isElementDragging.value || isResizing.value) return
  const rect = containerEl.value?.getBoundingClientRect()
  if (!rect) return
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  let title = '', sub = '', channels = []
  if (el.type === 'tower') {
    const t = towerForEl(el)
    title = t?.name || el.towerName || 'Turm'
    sub = t ? `${filledSlotsLabel(el)}${t.side ? ' · ' + t.side : ''}` : ''
    channels = (t?.slots ?? []).filter(s => s.channel_id).map(s => props.channels.find(c => c.id === s.channel_id)?.channel ?? '?')
  } else if (el.type === 'bar') {
    const b = barForEl(el)
    title = b?.name || el.barName || 'Stange'
    sub = b ? `${fixturesLabel(el)}${b.zug_nr ? ' · Zug ' + b.zug_nr : ''}${b.length_cm ? ' · ' + formatLength(b.length_cm) : ''}` : ''
    channels = (b?.fixtures ?? []).map(f => channelNrById(f.channel_id))
  } else if (el.type === 'channel') {
    title = `Kanal ${el.channel}`
    const info = props.channels.find(ch => ch.channel === el.channel)
    sub = [info?.device, info?.position].filter(Boolean).join(' · ')
  }
  if (!title) return
  tooltip.value = { visible: true, x, y, title, sub, channels }
}
function hideTooltip() {
  tooltip.value = { ...tooltip.value, visible: false }
}

const {
  rulerPoints, scalePixelsPerMeter, showRulerDialog, rulerDistanceInput,
  scaleBarWidth, scaleBarLabel,
  addRulerPoint, commitCalibration, cancelCalibration,
} = useRulerCalibration()

function towerForEl(el) { return props.towers.find(t => t.id === el.towerId) ?? null }
function filledSlotsLabel(el) {
  const t = towerForEl(el)
  if (!t) return ''
  const filled = (t.slots ?? []).filter(s => s.channel_id).length
  return `${filled}/${t.slot_count} Slots`
}
function barForEl(el) { return props.bars.find(b => b.id === el.barId) ?? null }
function fixturesLabel(el) {
  const b = barForEl(el)
  if (!b) return ''
  return `${(b.fixtures ?? []).length} Scheinwerfer`
}
function fixtureXOffset(positionCm, lengthCm, widthPx) {
  const len = lengthCm || 600
  return ((positionCm + len / 2) / len) * widthPx
}
function channelNrById(channelId, fallback = '?') {
  return props.channels.find(c => c.id === channelId)?.channel ?? fallback
}
function pillW(_channel) { return 62 }
function noteTextWidth(text) { return Math.max(40, (text?.length ?? 0) * 6.2 + 20) }
function typeLabel(type) { return getElementLabel(type) }

function getArrowPoints(channel, rot) {
  const rad = (rot || 0) * Math.PI / 180
  const w = pillW(channel)
  const r = CHANNEL_PILL_RADIUS
  const flatW = w / 2 - r

  const dx = Math.cos(rad)
  const dy = Math.sin(rad)

  let bx = 0, by = 0
  if (Math.abs(dy) > 0.001) {
    const yEdge = dy > 0 ? r : -r
    const xIntersect = yEdge * dx / dy
    if (xIntersect >= -flatW && xIntersect <= flatW) {
      bx = xIntersect
      by = yEdge
    }
  }

  if (bx === 0 && by === 0) {
    const cx = dx > 0 ? flatW : -flatW
    const B = -2 * dx * cx
    const C = cx * cx - r * r
    const disc = B * B - 4 * C
    if (disc >= 0) {
      const t = (-B + Math.sqrt(disc)) / 2
      bx = t * dx
      by = t * dy
    }
  }

  const len = 40
  return { x1: bx, y1: by, x2: bx + dx * len, y2: by + dy * len }
}

// Zählt jeden loadBackground()-Aufruf durch — bei schnell wechselndem imageUrl
// (Upload, Undo/Redo) kann eine ältere fetch/Image-Decode-Kette erst nach
// einer neueren auflösen; ohne diesen Abgleich würde die ältere Antwort das
// schon korrekt angezeigte neuere Bild überschreiben und dessen Blob-URL
// unter ihm wegrevoken.
let backgroundLoadToken = 0

async function loadBackground(url) {
  const token = ++backgroundLoadToken
  backgroundLoadError.value = false
  if (!url) { revokeActiveBlobUrl(); bgImage.value = null; bgImageSrc.value = ''; return }

  const isSvg = url.split('?')[0].toLowerCase().endsWith('.svg')
    || url.startsWith('data:image/svg')

  if (isSvg) {
    revokeActiveBlobUrl()
    // Stage ist immer fest auf den PDF-Druckbereich (A4 quer) fixiert (siehe unten).
    const REF_W = 2000
    stageSize.value = { width: REF_W, height: Math.round(REF_W / PDF_PRINT_AREA_RATIO) }
    bgImage.value = null
    bgImageSrc.value = url
    nextTick(() => fitToContainer())
    return
  }

  let blobUrl
  try {
    const blob = await fetch(url, { cache: 'reload', headers: { Authorization: 'Bearer ' + (getToken() || '') } }).then(r => r.blob())
    blobUrl = URL.createObjectURL(blob)
  } catch (err) {
    if (token !== backgroundLoadToken) return // überholt durch einen neueren Aufruf
    console.error('Hintergrundbild konnte nicht geladen werden:', err)
    backgroundLoadError.value = true
    return
  }

  const img = new Image()
  img.onload = () => {
    if (token !== backgroundLoadToken) { URL.revokeObjectURL(blobUrl); return } // überholt — verwerfen, nicht anzeigen
    // Stage ist immer fest auf den PDF-Druckbereich (A4 quer) fixiert, unabhängig
    // vom Bildseitenverhältnis; das Bild wird unverzerrt eingepasst (siehe
    // bg-image preserveAspectRatio). So bleibt die Darstellung nach jedem Laden
    // (Upload wie Seiten-Reload) konsistent.
    const REF_W = 2000
    stageSize.value = { width: REF_W, height: Math.round(REF_W / PDF_PRINT_AREA_RATIO) }
    revokeActiveBlobUrl()
    activeBlobUrl = blobUrl
    bgImage.value = img
    bgImageSrc.value = blobUrl
    nextTick(() => fitToContainer())
  }
  img.onerror = () => {
    URL.revokeObjectURL(blobUrl)
    if (token !== backgroundLoadToken) return // überholt durch einen neueren Aufruf
    console.error('Hintergrundbild konnte nicht dekodiert werden')
    backgroundLoadError.value = true
  }
  img.src = blobUrl
}

watch(() => props.imageUrl, loadBackground, { immediate: true })

function getPointerPos(e) {
  if (!svgRef.value) return { x: 0, y: 0 }
  const rect = svgRef.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / stageScale.value,
    y: (e.clientY - rect.top) / stageScale.value
  }
}

function getBounds(el) { return getElementBounds(el) }

function getTransform(el) {
  const rot = el.rotation || 0
  // channel positioniert sich immer über translate() statt x/y-Attribute —
  // strukturell keine Rotation, unabhängig von rot bleibt es dabei.
  if (el.type === 'channel') return `translate(${el.x}, ${el.y})`
  if (!rot) return ''
  // Nur Typen mit eigenem Rotationszentrum (line/rect/ellipse/text) rotieren
  // um ihre Mitte; alles andere (aktuell nur tower/bar, die in der UI ohnehin
  // keinen Rotationsgriff haben) fällt auf (0,0) zurück, wie im Original.
  const getCenter = ELEMENT_TYPES[el.type]?.getCenter
  const { x: cx, y: cy } = getCenter ? getCenter(el) : { x: 0, y: 0 }
  return `rotate(${rot} ${cx} ${cy})`
}

function onNodeMouseDown(id, e) {
  if (activeTool.value !== 'select') return
  e.stopPropagation()
  e.preventDefault()
  if (e.shiftKey) {
    const s = new Set(selectedIds.value)
    s.has(id) ? s.delete(id) : s.add(id)
    selectedIds.value = s
  } else if (!selectedIds.value.has(id)) {
    selectedIds.value = new Set([id])
  }

  drawStart.value = getPointerPos(e)
  beginElementDrag()
}

// Text-Edit muss hier ausgelöst werden, nicht in einem separaten Container-Dblclick-Handler:
// @dblclick.stop auf dem <g> unten verhindert, dass ein Doppelklick auf ein Element je den
// Container erreicht (und ein Doppelklick daneben löscht die Auswahl schon beim ersten der
// beiden Klicks, siehe onContainerMouseDown) — ein separater Handler auf dem Container wäre
// für Text-Elemente strukturell unerreichbar.
function onNodeDblClick(id) {
  if (activeTool.value !== 'select') return
  selectedIds.value = new Set([id])
  const el = elements.value.find(x => x.id === id)
  if (el?.type === 'text') {
    beginTextEdit(el, svgRef.value, containerEl.value)
  }
}

function onContainerMouseDown(e) {
  const pos = getPointerPos(e)
  if (activeTool.value === 'pan' || spaceHeld.value) {
    startPan(e)
    return
  }
  if (activeTool.value === 'select') {
    if (!e.shiftKey) selectedIds.value = new Set()
    drawStart.value = pos
    lassoRect.value = null
    return
  }
  if (['line', 'rect', 'ellipse'].includes(activeTool.value)) {
    drawStart.value = pos
    preview.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, x: pos.x, y: pos.y, w: 0, h: 0, cx: pos.x, cy: pos.y, rx: 0, ry: 0 }
  } else if (activeTool.value === 'channel' || activeTool.value === 'text') {
    drawStart.value = pos
  } else if (activeTool.value === 'channel-pending' && pendingChannelForPlacement.value) {
    drawStart.value = pos
  } else if (activeTool.value === 'tower-pending' && pendingTowerForPlacement.value) {
    drawStart.value = pos
  } else if (activeTool.value === 'bar-pending' && pendingBarForPlacement.value) {
    drawStart.value = pos
  }
}

// Tool-spezifisches Preview-Rendering während des Ziehens (nach dem Guard-Chain-Teil in
// onContainerMouseMove, der Panning/Ghost/Resize/Drag behandelt und immer früh zurückkehrt).
// Lookup statt if/else-Kette, da die Zweige rein und zustandslos sind (anders als z.B.
// handlePendingToolMouseUp, das echten Kontrollfluss/Rückgabewerte pro Zweig braucht).
const DRAW_PREVIEW_HANDLERS = {
  select: (pos, start) => {
    lassoRect.value = { x: Math.min(pos.x, start.x), y: Math.min(pos.y, start.y), w: Math.abs(pos.x - start.x), h: Math.abs(pos.y - start.y) }
  },
  line: (pos) => {
    preview.value = { ...preview.value, x2: pos.x, y2: pos.y }
  },
  rect: (pos, start) => {
    preview.value = { x: Math.min(start.x, pos.x), y: Math.min(start.y, pos.y), w: Math.abs(pos.x - start.x), h: Math.abs(pos.y - start.y) }
  },
  ellipse: (pos, start) => {
    preview.value = { cx: (start.x + pos.x) / 2, cy: (start.y + pos.y) / 2, rx: Math.abs(pos.x - start.x) / 2, ry: Math.abs(pos.y - start.y) / 2 }
  },
}

function onContainerMouseMove(e) {
  if (isPanning.value) {
    updatePan(e)
    return
  }

  if (['channel-pending', 'tower-pending', 'bar-pending'].includes(activeTool.value)) {
    const rect = containerEl.value?.getBoundingClientRect()
    if (rect) ghostPos.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const pos = getPointerPos(e)

  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(x => x.id === pendingDirectionId.value)
    if (el) el.rotation = Math.atan2(pos.y - el.y, pos.x - el.x) * 180 / Math.PI
    return
  }

  if (isResizing.value) {
    applyResizeMove(pos)
    return
  }

  if (isElementDragging.value && drawStart.value) {
    applyDragMove(pos, drawStart.value)
    return
  }

  if (!drawStart.value) return

  DRAW_PREVIEW_HANDLERS[activeTool.value]?.(pos, drawStart.value)
}

// Gemeinsamer Ablauf für die drei "*-pending"-Platzierungswerkzeuge (Kanal/Turm/Stange):
// Element aus der Pending-Auswahl an der Pointer-Position erzeugen, Pending-State räumen,
// Folgewerkzeug aktivieren. buildElement bekommt die gerasterte Pointer-Position und liefert
// die typ-spezifischen Felder; afterAdd erlaubt den channel-pending-Sonderfall (Richtung
// setzen statt direkt zu 'select' zurückzukehren).
function commitPendingPlacement(e, buildElement, { nextTool = 'select', afterAdd } = {}) {
  const pos = getPointerPos(e)
  const id = uuid()
  addElement({ id, ...buildElement(pos) })
  clearPendingPlacement()
  afterAdd?.(id)
  activeTool.value = nextTool
  drawStart.value = null
  emitChange()
}

function handlePendingToolMouseUp(e) {
  if (activeTool.value === 'channel-pending' && pendingChannelForPlacement.value && drawStart.value) {
    const ch = pendingChannelForPlacement.value
    commitPendingPlacement(e, pos => ({ type: 'channel', x: snap(pos.x), y: snap(pos.y), channel: ch.channel, rotation: 0 }),
      { nextTool: 'channel-direction', afterAdd: id => { pendingDirectionId.value = id } })
    return true
  }
  if (activeTool.value === 'tower-pending' && pendingTowerForPlacement.value && drawStart.value) {
    const tower = pendingTowerForPlacement.value
    commitPendingPlacement(e, pos => ({ type: 'tower', x: snap(pos.x - 60), y: snap(pos.y - 35), w: 120, h: 70, towerId: tower.id, towerName: tower.name, rotation: 0 }))
    return true
  }
  if (activeTool.value === 'bar-pending' && pendingBarForPlacement.value && drawStart.value) {
    const bar = pendingBarForPlacement.value
    const w = barWidthPx(bar.length_cm || 600)
    commitPendingPlacement(e, pos => ({ type: 'bar', x: snap(pos.x - w / 2), y: snap(pos.y - 14), w, h: 28, barId: bar.id, barName: bar.name, rotation: 0 }))
    return true
  }
  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(x => x.id === pendingDirectionId.value)
    if (el) { el.rotation = Math.atan2(getPointerPos(e).y - el.y, getPointerPos(e).x - el.x) * 180 / Math.PI; emitChange() }
    pendingDirectionId.value = null; activeTool.value = 'select'
    return true
  }
  if (isPanning.value) { endPan(); return true }
  if (isResizing.value) {
    finishResize()
    return true
  }
  if (isElementDragging.value) {
    finishDrag()
    drawStart.value = null
    return true
  }
  return false
}

function handleDrawMouseUp(e) {
  if (activeTool.value === 'ruler') {
    addRulerPoint(getPointerPos(e))
    drawStart.value = null
    return
  }

  if (!drawStart.value) return
  const pos = getPointerPos(e)
  const dist = Math.hypot(pos.x - drawStart.value.x, pos.y - drawStart.value.y)

  if (activeTool.value === 'select' && lassoRect.value) {
    const { x, y, w, h } = lassoRect.value
    const inLasso = elements.value.filter(el => {
      const { x: cx, y: cy } = getElementCenter(el)
      return cx >= x && cx <= x + w && cy >= y && cy <= y + h
    })
    selectedIds.value = new Set(inLasso.map(e => e.id))
    lassoRect.value = null; drawStart.value = null
    return
  }

  if (dist > 5) {
    const createFromDrag = ELEMENT_TYPES[activeTool.value]?.createFromDrag
    if (createFromDrag) {
      addElement({ id: uuid(), ...createFromDrag(drawStart.value, pos, snap) })
      emitChange()
    }
    activeTool.value = 'select'
  } else {
    if (activeTool.value === 'channel') {
      channelPickerPos.value = { x: snap(drawStart.value.x), y: snap(drawStart.value.y) }
      channelSearch.value = ''; showChannelPicker.value = true
    } else if (activeTool.value === 'text') {
      addElement({ id: uuid(), type: 'text', x: snap(drawStart.value.x), y: snap(drawStart.value.y), text: 'Text', rotation: 0, color: '#9ca3af', fontSize: 16, fontStyle: 'normal' })
      emitChange(); activeTool.value = 'select'
    } else if (activeTool.value === 'select') {
      selectedIds.value = new Set()
    }
  }

  drawStart.value = null; preview.value = null; lassoRect.value = null
}

function onContainerMouseUp(e) {
  if (handlePendingToolMouseUp(e)) return
  handleDrawMouseUp(e)
}

function resetView() { resetViewport(!!bgImage.value) }

function addElement(el) { elements.value.push(el) }
function deleteSelected() {
  if (selectedIds.value.size === 0) return
  elements.value = elements.value.filter(e => !selectedIds.value.has(e.id))
  selectedIds.value = new Set(); emitChange()
}
function openChannelPlacer() {
  openChannelPlacerAt({ x: snap(stageSize.value.width / 2 - panOffset.value.x), y: snap(stageSize.value.height / 2 - panOffset.value.y) })
  activeTool.value = 'channel'
}
function openTowerPlacer() {
  openTowerPlacerAt({ x: snap(stageSize.value.width / 2 - panOffset.value.x), y: snap(stageSize.value.height / 2 - panOffset.value.y) })
}
function towerAlreadyPlaced(towerId) {
  return elements.value.some(e => e.type === 'tower' && e.towerId === towerId)
}
function placeTowerNode(tower) {
  pickTowerNode(tower)
  activeTool.value = 'tower-pending'
}

function openBarPlacer() {
  openBarPlacerAt({ x: snap(stageSize.value.width / 2 - panOffset.value.x - 80), y: snap(stageSize.value.height / 2 - panOffset.value.y) })
}
function barAlreadyPlaced(barId) {
  return elements.value.some(e => e.type === 'bar' && e.barId === barId)
}
function barWidthPx(lengthCm) {
  if (scalePixelsPerMeter.value > 0) return Math.round((lengthCm / 100) * scalePixelsPerMeter.value)
  return Math.min(Math.max(Math.round(lengthCm / 4), 80), 400)
}
function placeBarNode(bar) {
  pickBarNode(bar)
  activeTool.value = 'bar-pending'
}

function commitRuler() {
  if (commitCalibration()) {
    // Alle platzierten Bars auf neuen Maßstab anpassen, Mitte beibehalten. Bleibt hier
    // (statt in useRulerCalibration), da es Bar-Elemente und barWidthPx mischt — siehe
    // Kommentar dort.
    elements.value.forEach(el => {
      if (el.type !== 'bar') return
      const bar = props.bars.find(b => b.id === el.barId)
      if (!bar) return
      const oldW = el.w || 160
      const newW = barWidthPx(bar.length_cm || 600)
      el.x = Math.round(el.x + oldW / 2 - newW / 2)
      el.w = newW
    })
    emitChange()
  }
  activeTool.value = 'select'
}
function cancelRuler() {
  cancelCalibration()
  activeTool.value = 'select'
}

function placeChannelCircle(ch) {
  const id = uuid()
  addElement({ id, type: 'channel', x: channelPickerPos.value.x, y: channelPickerPos.value.y, channel: ch.channel, rotation: 0 })
  showChannelPicker.value = false; pendingDirectionId.value = id; activeTool.value = 'channel-direction'; emitChange()
}
function onImageFileSelected(e) {
  const file = e.target.files?.[0]
  if (file) emit('upload-image', file)
  e.target.value = ''
}
function jumpToChannel() { if (selectedElement.value?.type === 'channel') emit('jump-to-channel', selectedElement.value.channel) }
function toggleNoArrow(el) { el.noArrow = !el.noArrow; emitChange() }
function toggleFontStyle(el) { el.fontStyle = el.fontStyle === 'bold' ? 'normal' : 'bold'; emitChange() }
function toggleFill(el) { el.fill = (el.fill && el.fill !== 'transparent') ? 'transparent' : '#ffffff'; emitChange() }
function exportData() {
  const data = { elements: elements.value }
  if (scalePixelsPerMeter.value > 0) data._scale = scalePixelsPerMeter.value
  return JSON.stringify(data)
}
function parseData(str) {
  // Kein Canvas-Data heißt leere Zeichnung — nicht einfach den bisherigen
  // Stand stehen lassen. Sichtbar u.a. beim Undo bis zurück zum allerersten,
  // nie gespeicherten Zustand (canvas_data ist dort null).
  if (!str) { elements.value = []; scalePixelsPerMeter.value = 0; return }
  try {
    const parsed = JSON.parse(str)
    if (Array.isArray(parsed)) {
      elements.value = parsed
    } else {
      elements.value = parsed.elements ?? []
      scalePixelsPerMeter.value = parsed._scale ?? 0
    }
  } catch {}
}

// Undo/Redo läuft über den serverseitigen Show-Undo-Stack (Strg+Z/Strg+Y werden
// global in ShowDetailView.vue behandelt, canvas_data ist Teil von
// server/db/full-state.js) — hier nur noch speichern, keine eigene History.
function emitChange() {
  emit('change', exportData())
}
function exportPNG() {
  exportFloorplanPNG(svgRef.value, stageSize.value, bgImage.value)
}

function isInputFocused() { const el = document.activeElement; return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || !!el?.isContentEditable }
function handleKeyDown(e) {
  if (isInputFocused()) return
  if (e.key === ' ') { e.preventDefault(); spaceHeld.value = true; return }
  if (!e.ctrlKey && !e.metaKey) {
    if (e.key === 'v' || e.key === 'V') { activeTool.value = 'select'; return }
    if (e.key === 'h' || e.key === 'H') { activeTool.value = 'pan'; return }
    if (e.key === 'l' || e.key === 'L') { activeTool.value = 'line'; return }
    if (e.key === 'r' || e.key === 'R') { activeTool.value = 'rect'; return }
    if (e.key === 'e' || e.key === 'E') { activeTool.value = 'ellipse'; return }
    if (e.key === 't' || e.key === 'T') { activeTool.value = 'text'; return }
    if (e.key === 'c' || e.key === 'C') { activeTool.value = 'channel'; return }
    if (e.key === 'g' || e.key === 'G') { showGrid.value = !showGrid.value; return }
    if (e.key === 'f' || e.key === 'F') { resetView(); return }
    if (e.key === 'Escape') { pendingDirectionId.value=null; clearPendingPlacement(); activeTool.value = 'select'; selectedIds.value = new Set(); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && selectedIds.value.size > 0) {
      e.preventDefault(); const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      elements.value.forEach(el => {
        if (!selectedIds.value.has(el.id)) return
        if (elementHasEndpoints(el.type)) { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy } else { el.x = (el.x || 0) + dx; el.y = (el.y || 0) + dy }
      })
      emitChange(); return
    }
  }
  if ((e.ctrlKey || e.metaKey)) {
    // Strg+Z/Strg+Y absichtlich nicht hier: laufen global über
    // ShowDetailView.vue (onUndoRedoKeydown, serverseitiger Show-Undo-Stack).
    if (e.key === 'c') { e.preventDefault(); copySelected(); return }
    if (e.key === 'v') { e.preventDefault(); pasteClipboard(); return }
    if (e.key === 'd') { e.preventDefault(); duplicateSelected(); return }
    if (e.key === 'a') { e.preventDefault(); selectedIds.value = new Set(elements.value.map(e => e.id)); return }
    if (e.key === '0') { e.preventDefault(); resetView(); return }
  }
}
function handleKeyUp(e) { if (e.key === ' ') spaceHeld.value = false }

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  revokeActiveBlobUrl()
})

watch(() => props.initialCanvasData, (newVal) => {
  parseData(newVal)
}, { immediate: true })

watch(() => props.pendingChannel, (ch) => {
  if (!ch) return
  pendingChannelForPlacement.value = ch
  activeTool.value = 'channel-pending'
  ghostPos.value = null
})

watch(() => props.bars, (newBars) => {
  if (!scalePixelsPerMeter.value) return
  let changed = false
  elements.value.forEach(el => {
    if (el.type !== 'bar') return
    const bar = newBars.find(b => b.id === el.barId)
    if (!bar) return
    const newW = barWidthPx(bar.length_cm || 600)
    if (el.w !== newW) {
      el.x = Math.round(el.x + (el.w || 160) / 2 - newW / 2)
      el.w = newW
      changed = true
    }
  })
  if (changed) emitChange()
}, { deep: true })
</script>

<style scoped>
@reference "../style.css";
.placement-banner-enter-active, .placement-banner-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.placement-banner-enter-from, .placement-banner-leave-to { opacity: 0; transform: translateY(-100%); }
.props-panel-enter-active, .props-panel-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.props-panel-enter-from, .props-panel-leave-to { opacity: 0; transform: translateY(100%); }
</style>

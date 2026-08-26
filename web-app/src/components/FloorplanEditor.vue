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
      @dblclick="onContainerDblClick"
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
              <rect :x="-pillW(el.channel)/2" y="-18" :width="pillW(el.channel)" :height="36" rx="18" fill="#dc3740" stroke="#dc3740" stroke-width="2" />
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
          <rect x="-31" y="-18" width="62" height="36" rx="18" fill="#dc3740" opacity="0.85" />
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

    <!-- Reassign Dialog -->
    <Dialog :open="!!reassignTargetId" @update:open="val => { if (!val) reassignTargetId = null }">
      <DialogContent class="sm:max-w-2xl flex flex-col max-h-[80vh]">
        <DialogHeader><DialogTitle>{{ t('floorplan.reassign.title') }}</DialogTitle></DialogHeader>
        <DialogBody class="flex-1 overflow-y-auto">
          <ChannelPickerGrid :channels="props.channels" :model-value="[]" v-model:search="channelSearch" :search-placeholder="t('action.search')" @pick="reassignChannel" @enter="reassignChannel" />
        </DialogBody>
        <DialogFooter><Button variant="outline" @click="reassignTargetId = null">{{ t('action.cancel') }}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

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
import {
  Copy, MousePointer2, Hand, Minus, Square, Circle, Type, CircleDot,
  Upload, ImageOff, Download, Trash2, Layers, AlignJustify, Ruler,
  X
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import ChannelPickerGrid from './show/ChannelPickerGrid.vue'
import { Label } from '@/components/ui/label'
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
const showChannelPicker = ref(false)
const channelPickerPos = ref({ x: 0, y: 0 })
const channelSearch = ref('')
const showTowerPicker = ref(false)
const towerPickerPos = ref({ x: 0, y: 0 })
const towerSearch = ref('')
const showBarPicker = ref(false)
const barPickerPos = ref({ x: 0, y: 0 })
const barSearch = ref('')
const filteredTowers = computed(() => {
  const q = towerSearch.value.trim().toLowerCase()
  if (!q) return props.towers
  return props.towers.filter(tower => (tower.name ?? '').toLowerCase().includes(q) || (tower.side ?? '').toLowerCase().includes(q))
})
const filteredBars = computed(() => {
  const q = barSearch.value.trim().toLowerCase()
  if (!q) return props.bars
  return props.bars.filter(bar => (bar.name ?? '').toLowerCase().includes(q))
})
const ghostBarWidth = computed(() => barWidthPx(pendingBarForPlacement.value?.length_cm || 600))
function channelNrForId(channelId) {
  return props.channels.find(c => c.id === channelId)?.channel ?? null
}
function towerChannels(tower) {
  return (tower.slots ?? [])
    .filter(slot => slot.channel_id)
    .sort((a, b) => a.slot_index - b.slot_index)
    .map(slot => channelNrForId(slot.channel_id))
    .filter(Boolean)
}
function barChannels(bar) {
  return (bar.fixtures ?? [])
    .filter(fx => fx.channel_id)
    .map(fx => channelNrForId(fx.channel_id))
    .filter(Boolean)
}
const reassignTargetId = ref(null)
const svgRef = ref(null)
const containerEl = ref(null)
const imageUploadInput = ref(null)
const history = ref([])
const historyIndex = ref(-1)
const lassoRect = ref(null)
const pendingDirectionId = ref(null)
const pendingChannelForPlacement = ref(null)
const pendingTowerForPlacement = ref(null)
const pendingBarForPlacement = ref(null)
const ghostPos = ref(null)

const bgImage = ref(null)
const bgImageSrc = ref('')
const containerSize = ref({ width: 1200, height: 800 })
const stageSize = ref({ width: 1200, height: 800 })

const stageScale = computed(() => {
  const sx = containerSize.value.width / stageSize.value.width
  const sy = containerSize.value.height / stageSize.value.height
  return Math.min(sx, sy, 1)
})
const containerOffsetX = computed(() => Math.round((containerSize.value.width - stageSize.value.width * stageScale.value) / 2))
const containerOffsetY = computed(() => Math.round((containerSize.value.height - stageSize.value.height * stageScale.value) / 2))

// Druckbereich im PDF-Export (A4 quer, minus Seitenränder/Titel/Fußzeile, siehe server/pdf.js)
const PDF_PRINT_AREA_RATIO = 267 / 160
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

const showGrid = ref(false)
const snapToGrid = ref(false)
const GRID_SIZE = 30
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref(null)
const spaceHeld = ref(false)
const clipboard = ref(null)
const textEditNode = ref(null)
const textEditValue = ref('')
const textEditStyle = ref({})
const textareaRef = ref(null)

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
    let ax, ay
    if (el.type === 'line') {
      ax = (el.x1 + el.x2) / 2; ay = (el.y1 + el.y2) / 2
    } else if (el.type === 'rect') {
      ax = el.x + el.w / 2; ay = el.y + el.h
    } else if (el.type === 'ellipse') {
      ax = el.x; ay = el.y + el.ry
    } else if (el.type === 'channel') {
      ax = el.x; ay = el.y + 18
    } else {
      ax = el.x; ay = el.y + 10
    }
    return { ...el, _anchorX: ax, _anchorY: ay, _noteX: ax, _noteY: ay + NOTE_LABEL_GAP }
  })
})

const isElementDragging = ref(false)
const elementWasDragged = ref(false)
const isResizing = ref(false)
const isArrowRotating = ref(false)
const hoveredId = ref(null)
const propertiesOpen = ref(false)
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

const rulerPoints = ref([])
const scalePixelsPerMeter = ref(0)
const showRulerDialog = ref(false)
const rulerDistanceInput = ref('')

const scaleBarWidth = computed(() => {
  if (scalePixelsPerMeter.value <= 0) return 0
  const candidates = [0.25, 0.5, 1, 2, 5, 10, 20, 50]
  const target = 80 / scalePixelsPerMeter.value
  const m = candidates.reduce((a, b) => Math.abs(a - target) < Math.abs(b - target) ? a : b)
  return m * scalePixelsPerMeter.value
})
const scaleBarLabel = computed(() => {
  if (scalePixelsPerMeter.value <= 0) return ''
  const candidates = [0.25, 0.5, 1, 2, 5, 10, 20, 50]
  const target = 80 / scalePixelsPerMeter.value
  const m = candidates.reduce((a, b) => Math.abs(a - target) < Math.abs(b - target) ? a : b)
  return m >= 1 ? `${m} m` : `${Math.round(m * 100)} cm`
})


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
function channelNrById(channelId) {
  return props.channels.find(c => c.id === channelId)?.channel ?? '?'
}
function pillW(_channel) { return 62 }
function noteTextWidth(text) { return Math.max(40, (text?.length ?? 0) * 6.2 + 20) }
function typeLabel(type) { return { line: 'Linie', rect: 'Rechteck', ellipse: 'Ellipse', text: 'Text', channel: 'Kanal', tower: 'Beleuchtungsgestell', bar: 'Zugstange' }[type] || type }

function getArrowPoints(channel, rot) {
  const rad = (rot || 0) * Math.PI / 180
  const w = pillW(channel)
  const r = 18
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

function fitToContainer() { panOffset.value = { x: 0, y: 0 } }

async function loadBackground(url) {
  if (!url) { bgImage.value = null; bgImageSrc.value = ''; return }

  const isSvg = url.split('?')[0].toLowerCase().endsWith('.svg')
    || url.startsWith('data:image/svg')

  if (isSvg) {
    // Stage ist immer fest auf den PDF-Druckbereich (A4 quer) fixiert (siehe unten).
    const REF_W = 2000
    stageSize.value = { width: REF_W, height: Math.round(REF_W / PDF_PRINT_AREA_RATIO) }
    bgImage.value = null
    bgImageSrc.value = url
    nextTick(() => fitToContainer())
    return
  }

  const blob = await fetch(url, { cache: 'reload', headers: { Authorization: 'Bearer ' + (getToken() || '') } }).then(r => r.blob())
  const blobUrl = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    // Stage ist immer fest auf den PDF-Druckbereich (A4 quer) fixiert, unabhängig
    // vom Bildseitenverhältnis; das Bild wird unverzerrt eingepasst (siehe
    // bg-image preserveAspectRatio). So bleibt die Darstellung nach jedem Laden
    // (Upload wie Seiten-Reload) konsistent.
    const REF_W = 2000
    stageSize.value = { width: REF_W, height: Math.round(REF_W / PDF_PRINT_AREA_RATIO) }
    bgImage.value = img
    bgImageSrc.value = blobUrl
    nextTick(() => fitToContainer())
  }
  img.src = blobUrl
}

watch(() => props.imageUrl, loadBackground, { immediate: true })

const gridLeft = computed(() => -panOffset.value.x)
const gridTop = computed(() => -panOffset.value.y)
const gridRight = computed(() => gridLeft.value + stageSize.value.width / stageScale.value)
const gridBottom = computed(() => gridTop.value + stageSize.value.height / stageScale.value)
const gridVerticalLines = computed(() => {
  const lines = [], start = Math.floor(gridLeft.value / GRID_SIZE) * GRID_SIZE
  for (let x = start; x <= gridRight.value; x += GRID_SIZE) lines.push(x)
  return lines
})
const gridHorizontalLines = computed(() => {
  const lines = [], start = Math.floor(gridTop.value / GRID_SIZE) * GRID_SIZE
  for (let y = start; y <= gridBottom.value; y += GRID_SIZE) lines.push(y)
  return lines
})

function snap(val) { return snapToGrid.value ? Math.round(val / GRID_SIZE) * GRID_SIZE : val }

function getPointerPos(e) {
  if (!svgRef.value) return { x: 0, y: 0 }
  const rect = svgRef.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / stageScale.value,
    y: (e.clientY - rect.top) / stageScale.value
  }
}

function getBounds(el) {
  if (el.type === 'rect') return { x: el.x, y: el.y, w: el.w, h: el.h }
  if (el.type === 'ellipse') return { x: el.x - el.rx, y: el.y - el.ry, w: el.rx * 2, h: el.ry * 2 }
  if (el.type === 'text') return { x: el.x - 5, y: el.y - 5, w: (el.fontSize||16)*5, h: (el.fontSize||16)+10 }
  if (el.type === 'tower') return { x: el.x, y: el.y, w: el.w || 120, h: el.h || 70 }
  if (el.type === 'bar') return { x: el.x, y: el.y, w: el.w || 160, h: el.h || 28 }
  return { x: 0, y: 0, w: 0, h: 0 }
}

function getTransform(el) {
  const rot = el.rotation || 0
  if (!rot) {
    if (el.type === 'channel') return `translate(${el.x}, ${el.y})`
    return ''
  }
  let cx = 0, cy = 0
  if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 } 
  else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 } 
  else if (el.type === 'ellipse') { cx = el.x; cy = el.y } 
  else if (el.type === 'text') { cx = el.x; cy = el.y } 
  else if (el.type === 'channel') {
    return `translate(${el.x}, ${el.y})`
  }
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
    propertiesOpen.value = false
  }

  isElementDragging.value = true
  elementWasDragged.value = false
  const pos = getPointerPos(e)
  drawStart.value = pos

  // Save initial state for dragging
  clipboard.value = [...selectedIds.value].map(sid => JSON.parse(JSON.stringify(elements.value.find(x => x.id === sid))))
}

function onNodeDblClick(id) {
  if (activeTool.value !== 'select') return
  selectedIds.value = new Set([id])
  propertiesOpen.value = true
}

let resizeObj = null
function startResizeLine(id, point, e) {
  e.stopPropagation()
  isResizing.value = true
  resizeObj = { id, point }
}
function startResizeRectEllipse(id, e) {
  e.stopPropagation()
  isResizing.value = true
  const el = elements.value.find(x => x.id === id)
  resizeObj = { id, initX: el.x, initY: el.y }
}

function onContainerMouseDown(e) {
  const pos = getPointerPos(e)
  if (activeTool.value === 'pan' || spaceHeld.value) {
    isPanning.value = true
    panStart.value = { mx: e.clientX, my: e.clientY, ox: panOffset.value.x, oy: panOffset.value.y }
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

function onContainerMouseMove(e) {
  if (isPanning.value && panStart.value) {
    const s = stageScale.value
    panOffset.value = { x: panStart.value.ox + (e.clientX - panStart.value.mx) / s, y: panStart.value.oy + (e.clientY - panStart.value.my) / s }
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

  if (isResizing.value && resizeObj) {
    const el = elements.value.find(x => x.id === resizeObj.id)
    if (el.type === 'line') {
      if (resizeObj.point === 1) { el.x1 = pos.x; el.y1 = pos.y }
      else { el.x2 = pos.x; el.y2 = pos.y }
    } else if (el.type === 'rect') {
      el.w = Math.max(5, pos.x - resizeObj.initX)
      el.h = Math.max(5, pos.y - resizeObj.initY)
    } else if (el.type === 'ellipse') {
      el.rx = Math.max(3, pos.x - resizeObj.initX)
      el.ry = Math.max(3, pos.y - resizeObj.initY)
    }
    return
  }

  if (isElementDragging.value && drawStart.value) {
    const dx = pos.x - drawStart.value.x
    const dy = pos.y - drawStart.value.y
    if (Math.hypot(dx, dy) > 3) elementWasDragged.value = true
    clipboard.value.forEach(init => {
      const el = elements.value.find(x => x.id === init.id)
      if (!el) return
      if (el.type === 'line') { el.x1 = init.x1 + dx; el.y1 = init.y1 + dy; el.x2 = init.x2 + dx; el.y2 = init.y2 + dy }
      else { el.x = init.x + dx; el.y = init.y + dy }
    })
    return
  }

  if (!drawStart.value) return

  if (activeTool.value === 'select') {
    lassoRect.value = { x: Math.min(pos.x, drawStart.value.x), y: Math.min(pos.y, drawStart.value.y), w: Math.abs(pos.x - drawStart.value.x), h: Math.abs(pos.y - drawStart.value.y) }
  } else if (activeTool.value === 'line') {
    preview.value = { ...preview.value, x2: pos.x, y2: pos.y }
  } else if (activeTool.value === 'rect') {
    preview.value = { x: Math.min(drawStart.value.x, pos.x), y: Math.min(drawStart.value.y, pos.y), w: Math.abs(pos.x - drawStart.value.x), h: Math.abs(pos.y - drawStart.value.y) }
  } else if (activeTool.value === 'ellipse') {
    preview.value = { cx: (drawStart.value.x + pos.x) / 2, cy: (drawStart.value.y + pos.y) / 2, rx: Math.abs(pos.x - drawStart.value.x) / 2, ry: Math.abs(pos.y - drawStart.value.y) / 2 }
  }
}

function onContainerMouseUp(e) {
  if (activeTool.value === 'channel-pending' && pendingChannelForPlacement.value && drawStart.value) {
    const pos = getPointerPos(e)
    const ch = pendingChannelForPlacement.value
    const id = uuid()
    addElement({ id, type: 'channel', x: snap(pos.x), y: snap(pos.y), channel: ch.channel, rotation: 0 })
    pendingChannelForPlacement.value = null
    ghostPos.value = null
    pendingDirectionId.value = id
    activeTool.value = 'channel-direction'
    drawStart.value = null
    emitChange()
    return
  }
  if (activeTool.value === 'tower-pending' && pendingTowerForPlacement.value && drawStart.value) {
    const pos = getPointerPos(e)
    const tower = pendingTowerForPlacement.value
    addElement({ id: uuid(), type: 'tower', x: snap(pos.x - 60), y: snap(pos.y - 35), w: 120, h: 70, towerId: tower.id, towerName: tower.name, rotation: 0 })
    pendingTowerForPlacement.value = null
    ghostPos.value = null
    activeTool.value = 'select'
    drawStart.value = null
    emitChange()
    return
  }
  if (activeTool.value === 'bar-pending' && pendingBarForPlacement.value && drawStart.value) {
    const pos = getPointerPos(e)
    const bar = pendingBarForPlacement.value
    const w = barWidthPx(bar.length_cm || 600)
    addElement({ id: uuid(), type: 'bar', x: snap(pos.x - w / 2), y: snap(pos.y - 14), w, h: 28, barId: bar.id, barName: bar.name, rotation: 0 })
    pendingBarForPlacement.value = null
    ghostPos.value = null
    activeTool.value = 'select'
    drawStart.value = null
    emitChange()
    return
  }
  if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
    const el = elements.value.find(x => x.id === pendingDirectionId.value)
    if (el) { el.rotation = Math.atan2(getPointerPos(e).y - el.y, getPointerPos(e).x - el.x) * 180 / Math.PI; emitChange() }
    pendingDirectionId.value = null; activeTool.value = 'select'
    return
  }
  if (isPanning.value) { isPanning.value = false; panStart.value = null; return }
  if (isResizing.value) { 
    isResizing.value = false; resizeObj = null
    elements.value.forEach(el => {
      if(el.type === 'line'){ el.x1=snap(el.x1); el.y1=snap(el.y1); el.x2=snap(el.x2); el.y2=snap(el.y2) }
      else if (el.type === 'rect') { el.w=snap(el.w); el.h=snap(el.h) }
      else if (el.type === 'ellipse') { el.rx=snap(el.rx); el.ry=snap(el.ry) }
    })
    emitChange()
    return
  }
  if (isElementDragging.value) {
    const wasDragged = elementWasDragged.value
    isElementDragging.value = false
    elementWasDragged.value = false
    elements.value.forEach(el => {
      if(!selectedIds.value.has(el.id)) return
      if(el.type === 'line'){ el.x1=snap(el.x1); el.y1=snap(el.y1); el.x2=snap(el.x2); el.y2=snap(el.y2) }
      else { el.x=snap(el.x); el.y=snap(el.y) }
    })
    drawStart.value = null
    emitChange()
    if (!wasDragged && selectedIds.value.size === 1) propertiesOpen.value = true
    return
  }

  if (activeTool.value === 'ruler') {
    const pos = getPointerPos(e)
    rulerPoints.value = [...rulerPoints.value, { x: pos.x, y: pos.y }]
    if (rulerPoints.value.length === 2) {
      rulerDistanceInput.value = ''
      showRulerDialog.value = true
    }
    drawStart.value = null
    return
  }

  if (!drawStart.value) return
  const pos = getPointerPos(e)
  const dist = Math.hypot(pos.x - drawStart.value.x, pos.y - drawStart.value.y)

  if (activeTool.value === 'select' && lassoRect.value) {
    const { x, y, w, h } = lassoRect.value
    const inLasso = elements.value.filter(el => {
      let cx, cy
      if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 }
      else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 }
      else { cx = el.x; cy = el.y }
      return cx >= x && cx <= x + w && cy >= y && cy <= y + h
    })
    selectedIds.value = new Set(inLasso.map(e => e.id))
    lassoRect.value = null; drawStart.value = null
    return
  }

  if (dist > 5) {
    if (activeTool.value === 'line') { addElement({ id: uuid(), type: 'line', x1: snap(drawStart.value.x), y1: snap(drawStart.value.y), x2: snap(pos.x), y2: snap(pos.y), rotation: 0, color: '#6b7280', strokeWidth: 5 }); emitChange() }
    else if (activeTool.value === 'rect') { addElement({ id: uuid(), type: 'rect', x: snap(Math.min(drawStart.value.x, pos.x)), y: snap(Math.min(drawStart.value.y, pos.y)), w: snap(Math.abs(pos.x - drawStart.value.x)), h: snap(Math.abs(pos.y - drawStart.value.y)), rotation: 0, color: 'transparent', strokeWidth: 0, fill: '#e5e5e8' }); emitChange() }
    else if (activeTool.value === 'ellipse') { addElement({ id: uuid(), type: 'ellipse', x: snap((drawStart.value.x + pos.x) / 2), y: snap((drawStart.value.y + pos.y) / 2), rx: snap(Math.abs(pos.x - drawStart.value.x) / 2), ry: snap(Math.abs(pos.y - drawStart.value.y) / 2), rotation: 0, color: 'transparent', strokeWidth: 0, fill: '#e5e5e8' }); emitChange() }
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

function resetView() { if (bgImage.value) fitToContainer(); else panOffset.value = { x: 0, y: 0 } }

function onContainerDblClick(e) {
  if (activeTool.value !== 'select') return
  if (selectedIds.value.size === 1) {
    const el = elements.value.find(x => x.id === [...selectedIds.value][0])
    if (el?.type === 'text') {
      textEditNode.value = el
      textEditValue.value = el.text
      const CTM = svgRef.value.getScreenCTM()
      const box = containerEl.value.getBoundingClientRect()
      textEditStyle.value = {
        top: (CTM.f + el.y * CTM.d - box.top) + 'px',
        left: (CTM.e + el.x * CTM.a - box.left) + 'px',
        minWidth: '80px', fontSize: (el.fontSize || 16) + 'px', transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: '0 0'
      }
      nextTick(() => textareaRef.value?.focus())
    }
  }
}

function commitTextEdit() {
  if (!textEditNode.value) return
  const el = elements.value.find(e => e.id === textEditNode.value.id)
  if (el) { el.text = textEditValue.value; emitChange() }
  textEditNode.value = null
}
function cancelTextEdit() { textEditNode.value = null }

function copySelected() {
  if (selectedIds.value.size === 0) return
  clipboard.value = elements.value.filter(e => selectedIds.value.has(e.id)).map(e => ({ ...e }))
}
function pasteClipboard() {
  if (!clipboard.value?.length) return
  const newIds = new Set()
  clipboard.value.forEach(el => {
    const newEl = { ...el, id: uuid(), x: (el.x ?? el.x1 ?? 0) + 20, y: (el.y ?? el.y1 ?? 0) + 20 }
    if (el.x1 !== undefined) { newEl.x1 = el.x1 + 20; newEl.y1 = el.y1 + 20; newEl.x2 = el.x2 + 20; newEl.y2 = el.y2 + 20 }
    elements.value.push(newEl); newIds.add(newEl.id)
  })
  selectedIds.value = newIds; emitChange()
}
function duplicateSelected() { copySelected(); pasteClipboard() }
function addElement(el) { elements.value.push(el) }
function deleteSelected() {
  if (selectedIds.value.size === 0) return
  elements.value = elements.value.filter(e => !selectedIds.value.has(e.id))
  selectedIds.value = new Set(); emitChange()
}
function openChannelPlacer() {
  channelPickerPos.value = { x: snap(stageSize.value.width / 2 - panOffset.value.x), y: snap(stageSize.value.height / 2 - panOffset.value.y) }
  channelSearch.value = ''
  activeTool.value = 'channel'
  showChannelPicker.value = true
}
function openTowerPlacer() {
  towerPickerPos.value = { x: snap(stageSize.value.width / 2 - panOffset.value.x), y: snap(stageSize.value.height / 2 - panOffset.value.y) }
  towerSearch.value = ''
  showTowerPicker.value = true
}
function towerAlreadyPlaced(towerId) {
  return elements.value.some(e => e.type === 'tower' && e.towerId === towerId)
}
function placeTowerNode(tower) {
  showTowerPicker.value = false
  pendingTowerForPlacement.value = tower
  activeTool.value = 'tower-pending'
  ghostPos.value = null
}

function openBarPlacer() {
  barPickerPos.value = { x: snap(stageSize.value.width / 2 - panOffset.value.x - 80), y: snap(stageSize.value.height / 2 - panOffset.value.y) }
  barSearch.value = ''
  showBarPicker.value = true
}
function barAlreadyPlaced(barId) {
  return elements.value.some(e => e.type === 'bar' && e.barId === barId)
}
function barWidthPx(lengthCm) {
  if (scalePixelsPerMeter.value > 0) return Math.round((lengthCm / 100) * scalePixelsPerMeter.value)
  return Math.min(Math.max(Math.round(lengthCm / 4), 80), 400)
}
function placeBarNode(bar) {
  showBarPicker.value = false
  pendingBarForPlacement.value = bar
  activeTool.value = 'bar-pending'
  ghostPos.value = null
}

function commitRuler() {
  const normalized = rulerDistanceInput.value.replace(',', '.')
  const meters = parseFloat(normalized)
  if (!isNaN(meters) && meters > 0 && rulerPoints.value.length === 2) {
    const dx = rulerPoints.value[1].x - rulerPoints.value[0].x
    const dy = rulerPoints.value[1].y - rulerPoints.value[0].y
    scalePixelsPerMeter.value = Math.sqrt(dx * dx + dy * dy) / meters
    // Alle platzierten Bars auf neuen Maßstab anpassen, Mitte beibehalten
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
  rulerPoints.value = []
  showRulerDialog.value = false
  activeTool.value = 'select'
}
function cancelRuler() {
  rulerPoints.value = []
  showRulerDialog.value = false
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
function openReassignPicker() { if (selectedElement.value?.type === 'channel') { reassignTargetId.value = selectedElement.value.id; channelSearch.value = '' } }
function reassignChannel(ch) {
  const el = elements.value.find(e => e.id === reassignTargetId.value)
  if (el) { el.channel = ch.channel; emitChange() }
  reassignTargetId.value = null
}
function updateRotation(id, deg) { const el = elements.value.find(e => e.id === id); if (el) { el.rotation = deg; emitChange() } }

function startRotationDrag(el, event) {
  event.preventDefault()
  event.stopPropagation()
  const rect = event.currentTarget.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  function onMove(e) {
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90
    updateRotation(el.id, Math.round(angle))
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function startArrowRotateDrag(el, event) {
  event.preventDefault()
  event.stopPropagation()
  isArrowRotating.value = true
  function onMove(e) {
    const pos = getPointerPos(e)
    const angle = Math.atan2(pos.y - el.y, pos.x - el.x) * 180 / Math.PI
    updateRotation(el.id, Math.round(angle))
  }
  function onUp() {
    isArrowRotating.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function toggleNoArrow(el) { el.noArrow = !el.noArrow; emitChange() }
function toggleFontStyle(el) { el.fontStyle = el.fontStyle === 'bold' ? 'normal' : 'bold'; emitChange() }
function toggleFill(el) { el.fill = (el.fill && el.fill !== 'transparent') ? 'transparent' : '#ffffff'; emitChange() }
function exportData() {
  const data = { elements: elements.value }
  if (scalePixelsPerMeter.value > 0) data._scale = scalePixelsPerMeter.value
  return JSON.stringify(data)
}
function parseData(str) {
  if (!str) return
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

function pushHistory() {
  const snap = exportData()
  let h = history.value.slice(0, historyIndex.value + 1)
  h.push(snap); if (h.length > 100) h = h.slice(-100)
  history.value = h; historyIndex.value = history.value.length - 1
}
function undo() {
  if (historyIndex.value <= 0) return
  historyIndex.value--; parseData(history.value[historyIndex.value])
  emit('change', history.value[historyIndex.value])
}
function redo() {
  if (historyIndex.value >= history.value.length - 1) return
  historyIndex.value++; parseData(history.value[historyIndex.value])
  emit('change', history.value[historyIndex.value])
}
function emitChange() {
  pushHistory()
  const data = exportData()
  emit('change', data)
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
    if (e.key === 'Escape') { if(activeTool.value==='channel-direction') pendingDirectionId.value=null; if(activeTool.value==='channel-pending') { pendingChannelForPlacement.value=null; ghostPos.value=null } if(activeTool.value==='tower-pending') { pendingTowerForPlacement.value=null; ghostPos.value=null } if(activeTool.value==='bar-pending') { pendingBarForPlacement.value=null; ghostPos.value=null } activeTool.value = 'select'; selectedIds.value = new Set(); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && selectedIds.value.size > 0) {
      e.preventDefault(); const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      elements.value.forEach(el => {
        if (!selectedIds.value.has(el.id)) return
        if (el.type === 'line') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy } else { el.x = (el.x || 0) + dx; el.y = (el.y || 0) + dy }
      })
      emitChange(); return
    }
  }
  if ((e.ctrlKey || e.metaKey)) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
    if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return }
    if (e.key === 'c') { e.preventDefault(); copySelected(); return }
    if (e.key === 'v') { e.preventDefault(); pasteClipboard(); return }
    if (e.key === 'd') { e.preventDefault(); duplicateSelected(); return }
    if (e.key === 'a') { e.preventDefault(); selectedIds.value = new Set(elements.value.map(e => e.id)); return }
    if (e.key === '0') { e.preventDefault(); resetView(); return }
  }
}
function handleKeyUp(e) { if (e.key === ' ') spaceHeld.value = false }

let resizeObserver = null
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  if (containerEl.value) {
    resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) containerSize.value = { width, height }
    })
    resizeObserver.observe(containerEl.value)
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  resizeObserver?.disconnect()
})

watch(() => props.initialCanvasData, (newVal) => {
  parseData(newVal); history.value = [exportData()]; historyIndex.value = 0
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
.fade-panel-enter-active, .fade-panel-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.fade-panel-enter-from, .fade-panel-leave-to { opacity: 0; transform: scale(0.95); }
.placement-banner-enter-active, .placement-banner-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.placement-banner-enter-from, .placement-banner-leave-to { opacity: 0; transform: translateY(-100%); }
.props-panel-enter-active, .props-panel-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.props-panel-enter-from, .props-panel-leave-to { opacity: 0; transform: translateY(100%); }
</style>

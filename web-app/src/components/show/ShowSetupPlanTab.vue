<template>
  <!-- Sub-Tab-Leiste (Mobile/Tablet) -->
  <div class="md:hidden shrink-0 flex overflow-x-auto border-b border-border bg-surface-raised">
    <div
      v-for="sub in setupPlanSubTabs"
      :key="sub.key"
      :class="[
        'shrink-0 flex items-center gap-1 pl-4 pr-1.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
        setupPlanTab === sub.key
          ? 'border-b-2 border-accent text-accent'
          : 'text-muted-foreground hover:text-foreground'
      ]"
    >
      <button @click="emit('update:setupPlanTab', sub.key)">{{ sub.label }}</button>
      <Button
        v-if="sub.sectionId && sub.sectionId !== setupPlanSectionId"
        variant="ghost"
        size="icon"
        class="size-5 rounded-sm text-muted-foreground/50 shrink-0"
        @click="emit('deleteSection', sub.sectionId)"
      >
        <X class="size-3.5" />
      </Button>
    </div>
  </div>

  <!-- Section-Subtabs -->
  <template v-for="sub in setupPlanSubTabs" :key="sub.key">
    <div
      v-if="sub.sectionId"
      v-show="setupPlanTab === sub.key"
      class="flex-1 min-h-0 flex flex-col pb-14 md:pb-0"
    >
      <div class="flex-1 min-h-0 overflow-y-auto" data-scroll-container>
        <SectionEditor
          :showId="showId"
          :sectionDefs="sectionDefs"
          :sectionContents="sectionContents"
          :setupMarkdown="setupMarkdown"
          :singleSectionId="sub.sectionId"
          :saveSectionDefsFn="persistSectionDefs"
          :labels="{
            titlePlaceholder: t('sections.title.placeholder'),
            fieldLabel: t('sections.field.label'),
            fieldValue: t('sections.field.value'),
            fieldAdd: t('sections.field.add'),
            addMarkdown: t('sections.add.markdown'),
            addFields: t('sections.add.fields'),
            addHelp: t('section.add.help'),
          }"
          @update:sectionDefs="emit('update:sectionDefs', $event)"
          @update:sectionContents="emit('update:sectionContents', $event)"
          @update:setupMarkdown="emit('setupChange', $event)"
          @sectionChange="emit('sectionChange')"
        />
      </div>
      <!-- Generierte Texte aus Bühne + Obermaschinerie — nur in der Aufbau-Section -->
      <GeneratedTextAccordion
        v-if="sub.sectionId === setupPlanSectionId"
        :lightingTowerEntries="lightingTowerGenerated"
        :flySystemEntries="flySystem"
        class="shrink-0"
        data-scroll-container
      />
    </div>
  </template>

  <div v-if="meta.use_towers !== false && setupPlanTab === 'lightingTower'" class="flex-1 min-h-0 overflow-hidden">
    <LightingTowerView
      :towers="towers"
      :channels="channels"
      :preselectedChannelId="setupPlanTab === 'lightingTower' ? activeChannelForAssign?.id : null"
      :saveToTemplateFn="meta.template ? saveTowerToTemplate : null"
      :templateName="meta.template"
      :fetchTemplateNamesFn="meta.template ? fetchTowerTemplateNames : null"
      :fromTemplateFn="meta.template ? () => openFromTemplateDialog('towers') : null"
      @assigned="emit('update:activeChannelForAssign', null)"
    />
  </div>

  <div v-if="meta.use_battens !== false && setupPlanTab === 'flySystem'" class="flex-1 min-h-0 overflow-hidden">
    <FlySystemView
      :battens="battens"
      :channels="channels"
      :preselectedChannelId="setupPlanTab === 'flySystem' ? activeChannelForAssign?.id : null"
      :saveToTemplateFn="meta.template ? saveBattenToTemplate : null"
      :templateName="meta.template"
      :fetchTemplateNamesFn="meta.template ? fetchBattenTemplateNames : null"
      :fromTemplateFn="meta.template ? () => openFromTemplateDialog('battens') : null"
      @assigned="emit('update:activeChannelForAssign', null)"
    />
  </div>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import { X } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { Button } from '@/components/ui/button'

const SectionEditor = defineAsyncComponent(() => import('./SectionEditor.vue'))
const LightingTowerView = defineAsyncComponent(() => import('./LightingTowerView.vue'))
const FlySystemView = defineAsyncComponent(() => import('./FlySystemView.vue'))
const GeneratedTextAccordion = defineAsyncComponent(() => import('./GeneratedTextAccordion.vue'))

const { t } = useLocale()

defineProps({
  showId: { type: String, required: true },
  setupPlanSubTabs: { type: Array, required: true },
  setupPlanTab: { type: String, required: true },
  setupPlanSectionId: { type: String, default: null },
  sectionDefs: { type: Array, required: true },
  sectionContents: { type: Object, required: true },
  setupMarkdown: { type: String, default: '' },
  persistSectionDefs: { type: Function, required: true },
  lightingTowerGenerated: { type: Array, default: () => [] },
  flySystem: { type: Array, default: () => [] },
  meta: { type: Object, required: true },
  towers: { type: Array, default: () => [] },
  battens: { type: Array, default: () => [] },
  channels: { type: Array, default: () => [] },
  activeChannelForAssign: { type: Object, default: null },
  saveTowerToTemplate: { type: Function, required: true },
  fetchTowerTemplateNames: { type: Function, required: true },
  saveBattenToTemplate: { type: Function, required: true },
  fetchBattenTemplateNames: { type: Function, required: true },
  openFromTemplateDialog: { type: Function, required: true },
})

const emit = defineEmits([
  'update:setupPlanTab',
  'deleteSection',
  'update:sectionDefs',
  'update:sectionContents',
  'setupChange',
  'sectionChange',
  'update:activeChannelForAssign',
])
</script>

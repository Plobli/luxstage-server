<template>
  <!-- Sub-Tab-Leiste (Mobile/Tablet) -->
  <div class="md:hidden shrink-0 flex overflow-x-auto border-b border-border bg-surface-raised">
    <div
      v-for="sub in aufbauSubTabs"
      :key="sub.key"
      :class="[
        'shrink-0 flex items-center gap-1 pl-4 pr-1.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
        aufbauTab === sub.key
          ? 'border-b-2 border-accent text-accent'
          : 'text-muted-foreground hover:text-foreground'
      ]"
    >
      <button @click="emit('update:aufbauTab', sub.key)">{{ sub.label }}</button>
      <Button
        v-if="sub.sectionId && sub.sectionId !== aufbauSectionId"
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
  <template v-for="sub in aufbauSubTabs" :key="sub.key">
    <div
      v-if="sub.sectionId"
      v-show="aufbauTab === sub.key"
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
        v-if="sub.sectionId === aufbauSectionId"
        :gassenturmEntries="gassenturmGenerated"
        :hangereiEntries="hangerei"
        class="shrink-0 max-h-[30vh] overflow-y-auto border-t border-border"
        data-scroll-container
      />
    </div>
  </template>

  <div v-if="meta.use_towers !== false && aufbauTab === 'gassenturm'" class="flex-1 min-h-0 overflow-hidden">
    <GassenturmView
      :towers="towers"
      :channels="channels"
      :preselectedChannelId="aufbauTab === 'gassenturm' ? activeChannelForAssign?.id : null"
      :saveToTemplateFn="meta.template ? saveTowerToTemplate : null"
      :templateName="meta.template"
      :fetchTemplateNamesFn="meta.template ? fetchTowerTemplateNames : null"
      :fromTemplateFn="meta.template ? () => openFromTemplateDialog('towers') : null"
      @assigned="emit('update:activeChannelForAssign', null)"
    />
  </div>

  <div v-if="meta.use_bars !== false && aufbauTab === 'zugstangen'" class="flex-1 min-h-0 overflow-hidden">
    <ZugstangenView
      :bars="bars"
      :channels="channels"
      :preselectedChannelId="aufbauTab === 'zugstangen' ? activeChannelForAssign?.id : null"
      :saveToTemplateFn="meta.template ? saveBarToTemplate : null"
      :templateName="meta.template"
      :fetchTemplateNamesFn="meta.template ? fetchBarTemplateNames : null"
      :fromTemplateFn="meta.template ? () => openFromTemplateDialog('bars') : null"
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
const GassenturmView = defineAsyncComponent(() => import('./GassenturmView.vue'))
const ZugstangenView = defineAsyncComponent(() => import('./ZugstangenView.vue'))
const GeneratedTextAccordion = defineAsyncComponent(() => import('./GeneratedTextAccordion.vue'))

const { t } = useLocale()

defineProps({
  showId: { type: String, required: true },
  aufbauSubTabs: { type: Array, required: true },
  aufbauTab: { type: String, required: true },
  aufbauSectionId: { type: String, default: null },
  sectionDefs: { type: Array, required: true },
  sectionContents: { type: Object, required: true },
  setupMarkdown: { type: String, default: '' },
  persistSectionDefs: { type: Function, required: true },
  gassenturmGenerated: { type: Array, default: () => [] },
  hangerei: { type: Array, default: () => [] },
  meta: { type: Object, required: true },
  towers: { type: Array, default: () => [] },
  bars: { type: Array, default: () => [] },
  channels: { type: Array, default: () => [] },
  activeChannelForAssign: { type: Object, default: null },
  saveTowerToTemplate: { type: Function, required: true },
  fetchTowerTemplateNames: { type: Function, required: true },
  saveBarToTemplate: { type: Function, required: true },
  fetchBarTemplateNames: { type: Function, required: true },
  openFromTemplateDialog: { type: Function, required: true },
})

const emit = defineEmits([
  'update:aufbauTab',
  'deleteSection',
  'update:sectionDefs',
  'update:sectionContents',
  'setupChange',
  'sectionChange',
  'update:activeChannelForAssign',
])
</script>

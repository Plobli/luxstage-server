import { createApp } from 'vue'
import { VueTolgee } from '@tolgee/vue'
import App from './App.vue'
import { router } from './router/index.js'
import { tolgee } from './tolgee'
import './style.css'

// System-Theme anwenden und bei Änderungen aktualisieren
function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}
const mq = window.matchMedia('(prefers-color-scheme: dark)')
applyTheme(mq.matches)
mq.addEventListener('change', e => applyTheme(e.matches))

createApp(App).use(router).use(VueTolgee, { tolgee }).mount('#app')

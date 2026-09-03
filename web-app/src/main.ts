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

const app = createApp(App)

// Ohne diese Handler bleiben Rendering-Fehler und unhandled promise rejections
// (z.B. ein vergessenes .catch() irgendwo im Frontend) komplett unsichtbar — nur
// Vues eigene Konsolen-Ausgabe, keine zentrale Stelle zum Protokollieren oder für
// spätere Nutzer-Benachrichtigung.
app.config.errorHandler = (err, instance, info) => {
  console.error('[global] Vue-Fehler:', err, info)
}
window.addEventListener('unhandledrejection', (event) => {
  console.error('[global] Unhandled Promise Rejection:', event.reason)
})

app.use(router).use(VueTolgee, { tolgee }).mount('#app')

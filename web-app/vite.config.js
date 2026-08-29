import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

let { version } = JSON.parse(readFileSync('../package.json', 'utf-8'))
const isRelease = process.env.GITHUB_REF_TYPE === 'tag'

if (!isRelease) {
  try {
    const buildNum = execSync('git rev-list --count HEAD', { stdio: 'pipe' }).toString().trim()
    version = `${version} Build ${buildNum}`
  } catch (e) {
    version = `${version} Build dev`
  }
}

export default defineConfig({
  plugins: [tailwindcss(), vue()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: 'dist', // direkt relativ zum Projektroot, kein Umweg über ../web-app/
    emptyOutDir: true, // alte Artefakte vor jedem Build bereinigen
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router'],
          'vendor-ui': ['reka-ui'],
          'vendor-utils': ['@vueuse/core'],
          'vendor-icons': ['lucide-vue-next'],
          'vendor-network': ['@vue-flow/core', '@vue-flow/background', '@vue-flow/controls', 'dagre'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['macbookohnenamen.mara-ulmer.ts.net'],
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})

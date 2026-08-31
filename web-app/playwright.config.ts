import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.e2e.local' })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 1000 },
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts|login\.spec\.ts|smoke\.spec\.ts/,
    },
    {
      name: 'chromium-unauth',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 } },
      testMatch: /login\.spec\.ts|smoke\.spec\.ts/,
    },
  ],
})

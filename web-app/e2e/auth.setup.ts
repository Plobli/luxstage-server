import { test as setup, expect } from '@playwright/test'

const username = process.env.E2E_USERNAME!
const password = process.env.E2E_PASSWORD!
const authFile = 'e2e/.auth/user.json'

setup('login', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /anmelden|login|submit/i }).click()
  await expect(page).toHaveURL(/\/(shows)?$/, { timeout: 10000 })
  await page.context().storageState({ path: authFile })
})

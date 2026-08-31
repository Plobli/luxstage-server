import { test, expect } from '@playwright/test'

const username = process.env.E2E_USERNAME!
const password = process.env.E2E_PASSWORD!

test('Login mit gültigen Zugangsdaten führt zur Übersicht', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /anmelden|login|submit/i }).click()
  await expect(page).toHaveURL(/\/(shows)?$/, { timeout: 10000 })
})

test('Login mit falschem Passwort zeigt Fehler', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#username').fill(username)
  await page.locator('#password').fill('falsches-passwort')
  await page.getByRole('button', { name: /anmelden|login|submit/i }).click()
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
  await expect(page).toHaveURL(/\/login/)
})

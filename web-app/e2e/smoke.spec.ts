import { test, expect } from '@playwright/test'

test('Login-Seite lädt', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('#username')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()
})

test('geschützte Route leitet ohne Login zu /login um', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('unbekannte Route zeigt Not-Found', async ({ page }) => {
  await page.goto('/does-not-exist')
  await expect(page).not.toHaveURL(/\/login/)
})

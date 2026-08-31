import { test, expect } from '@playwright/test'

test('Show erstellen und wieder archivieren', async ({ page }) => {
  await page.goto('/')
  const showName = `E2E-Test-${Date.now()}`

  await page.getByTestId('show-fab').click()
  await page.getByTestId('show-create-quick').click()

  await page.locator('#showName').fill(showName)
  await page.getByTestId('show-create-submit').click()

  // Erstellen öffnet direkt die Show-Detailansicht — zurück zur Liste zum Archivieren.
  await expect(page).toHaveURL(/\/shows\//, { timeout: 10000 })
  await page.goto('/')

  const row = page.getByTestId(`show-row-${showName}`)
  await expect(row).toBeVisible({ timeout: 10000 })

  // Archivieren-Button ist bis zum Hover opacity-0; zudem kann ein Polling-Refetch
  // die Zeile während des Klicks neu rendern (siehe WebApp-Architektur: Polling statt SSE) — daher Retry.
  await expect(async () => {
    await row.hover()
    await row.getByTestId('show-archive-btn').click({ timeout: 2000 })
  }).toPass({ timeout: 15000 })
  await page.getByTestId('confirm-dialog-confirm').click()
  await expect(row).toBeHidden({ timeout: 10000 })
})

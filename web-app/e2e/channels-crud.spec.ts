import { test, expect } from '@playwright/test'

test('Kanal in einer Show anlegen und wieder löschen', async ({ page }) => {
  const showName = `E2E-Channel-Test-${Date.now()}`
  const channelNr = String(Date.now()).slice(-4)

  // Show anlegen
  await page.goto('/')
  await page.getByTestId('show-fab').click()
  await page.getByTestId('show-create-quick').click()
  await page.locator('#showName').fill(showName)
  await page.getByTestId('show-create-submit').click()
  await expect(page).toHaveURL(/\/shows\//, { timeout: 10000 })

  // Kanal anlegen
  await page.getByTestId('channel-add-btn').click()
  await page.getByTestId('channel-add-nr-input').fill(channelNr)
  await page.getByTestId('channel-add-save').click()

  const row = page.locator(`[data-ch-nr="${channelNr}"]`)
  await expect(row).toBeVisible({ timeout: 10000 })

  // Kanal löschen
  await row.hover()
  await row.getByTestId('channel-row-delete').click()
  await page.getByTestId('channel-row-delete-confirm').click()
  await expect(row).toBeHidden({ timeout: 10000 })

  // Aufräumen: Show wieder archivieren
  await page.goto('/')
  const showRow = page.getByTestId(`show-row-${showName}`)
  await expect(showRow).toBeVisible({ timeout: 10000 })
  await expect(async () => {
    await showRow.hover()
    await showRow.getByTestId('show-archive-btn').click({ timeout: 2000 })
  }).toPass({ timeout: 15000 })
  await page.getByTestId('confirm-dialog-confirm').click()
  await expect(showRow).toBeHidden({ timeout: 10000 })
})

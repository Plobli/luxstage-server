import { test, expect } from '@playwright/test'

test('Undo/Redo einer Kanal-Erstellung (einfach)', async ({ page }) => {
  const showName = `E2E-UndoRedo-Test-${Date.now()}`
  const channelNr = String(Date.now()).slice(-4)

  // Show anlegen
  await page.goto('/')
  await page.getByTestId('show-fab').click()
  await page.getByTestId('show-create-quick').click()
  await page.locator('#showName').fill(showName)
  await page.getByTestId('show-create-submit').click()
  await expect(page).toHaveURL(/\/shows\//, { timeout: 10000 })

  // Kanal anlegen — Speichern ist debounced (800ms, useShowChannels.ts SAVE_DEBOUNCE_MS),
  // daher explizit auf den PUT warten, bevor Undo/Redo den Server-Stack antasten.
  await page.getByTestId('channel-add-btn').click()
  await page.getByTestId('channel-add-nr-input').fill(channelNr)
  const savePut = page.waitForResponse(r => r.url().includes('/channels') && r.request().method() === 'PUT')
  await page.getByTestId('channel-add-save').click()
  await savePut

  const row = page.locator(`[data-ch-nr="${channelNr}"]`)
  await expect(row).toBeVisible({ timeout: 10000 })

  // Undo: Kanal-Erstellung rückgängig machen
  await expect(page.getByTestId('undo-btn')).toBeEnabled({ timeout: 10000 })
  await page.getByTestId('undo-btn').click()
  await expect(row).toBeHidden({ timeout: 10000 })

  // Redo: Kanal-Erstellung wiederherstellen
  await expect(page.getByTestId('redo-btn')).toBeEnabled({ timeout: 10000 })
  await page.getByTestId('redo-btn').click()
  await expect(row).toBeVisible({ timeout: 10000 })

  // Aufräumen
  await row.hover()
  await row.getByTestId('channel-row-delete').click()
  await page.getByTestId('channel-row-delete-confirm').click()
  await expect(row).toBeHidden({ timeout: 10000 })

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

test('Mehrfaches Undo/Redo über mehrere Kanäle hinweg', async ({ page }) => {
  const showName = `E2E-UndoRedo-Multi-${Date.now()}`
  const base = Number(String(Date.now()).slice(-4))
  const nrs = [String(base), String(base + 1), String(base + 2)]

  await page.goto('/')
  await page.getByTestId('show-fab').click()
  await page.getByTestId('show-create-quick').click()
  await page.locator('#showName').fill(showName)
  await page.getByTestId('show-create-submit').click()
  await expect(page).toHaveURL(/\/shows\//, { timeout: 10000 })

  // Drei Kanäle nacheinander anlegen, jeweils den Save abwarten, damit jede
  // Aktion einen eigenen Eintrag auf dem Server-seitigen Undo-Stack erzeugt.
  for (const nr of nrs) {
    await page.getByTestId('channel-add-btn').click()
    await page.getByTestId('channel-add-nr-input').fill(nr)
    const savePut = page.waitForResponse(r => r.url().includes('/channels') && r.request().method() === 'PUT')
    await page.getByTestId('channel-add-save').click()
    await savePut
    await expect(page.locator(`[data-ch-nr="${nr}"]`)).toBeVisible({ timeout: 10000 })
  }

  // Dreimal Undo: Kanäle verschwinden in umgekehrter Reihenfolge (LIFO)
  for (const nr of [...nrs].reverse()) {
    await expect(page.getByTestId('undo-btn')).toBeEnabled({ timeout: 10000 })
    await page.getByTestId('undo-btn').click()
    await expect(page.locator(`[data-ch-nr="${nr}"]`)).toBeHidden({ timeout: 10000 })
  }

  // Kein weiterer Undo-Schritt für diese drei Aktionen mehr möglich wäre falsch zu prüfen
  // (die Show-Erstellung selbst liegt noch auf dem Stack) — stattdessen: alle drei Kanäle weg.
  for (const nr of nrs) {
    await expect(page.locator(`[data-ch-nr="${nr}"]`)).toBeHidden({ timeout: 10000 })
  }

  // Dreimal Redo: Kanäle kommen in ursprünglicher Reihenfolge zurück
  for (const nr of nrs) {
    await expect(page.getByTestId('redo-btn')).toBeEnabled({ timeout: 10000 })
    await page.getByTestId('redo-btn').click()
    await expect(page.locator(`[data-ch-nr="${nr}"]`)).toBeVisible({ timeout: 10000 })
  }

  // Aufräumen
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

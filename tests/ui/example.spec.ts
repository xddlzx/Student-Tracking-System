import { test, expect } from '@playwright/test'

test('placeholder ui test', async ({ page }) => {
  await page.goto('http://localhost:8080')
  expect(true).toBeTruthy()
})

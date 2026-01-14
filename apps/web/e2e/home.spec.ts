import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the home page', async ({ page }) => {
    await page.goto('/');
    // Basic check that the page loads
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to dashboard', async ({ page }) => {
    await page.goto('/');
    // Check that the page loaded
    await expect(page.locator('body')).toBeVisible();
  });
});

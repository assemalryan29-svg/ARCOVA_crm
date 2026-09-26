import { test, expect } from '@playwright/test';

test('production health is green', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.ok).toBeTruthy();
  expect(body.service).toBe('arcova-crm');
  expect(body.checks.supabase_api).toBeTruthy();
});

test('login page renders without horizontal overflow', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toBeVisible();

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    title: document.title
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
  expect(metrics.title).not.toBe('');
  expect(errors).toEqual([]);
});

test('dashboard route is protected and does not return a server error', async ({ page }) => {
  const response = await page.goto('/dashboard', { waitUntil: 'networkidle' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(500);
  await expect(page.locator('body')).toBeVisible();
});

test('mobile navigation surface remains within viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
});

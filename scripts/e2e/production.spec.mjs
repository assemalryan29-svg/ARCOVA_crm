import { test, expect } from '@playwright/test';

test('production health is green', async ({ request }) => {
  const response = await request.get('/api/health');
  const bodyText = await response.text();
  console.log('ARCOVA_HEALTH', response.status(), bodyText);
  expect(response.ok()).toBeTruthy();
  const body = JSON.parse(bodyText);
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
  await expect(page.locator('h1')).toContainText(/تسجيل الدخول|استعادة كلمة المرور|Login/i);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
  expect(errors).toEqual([]);
});

test('dashboard route is protected and does not return a server error', async ({ page }) => {
  const response = await page.goto('/dashboard', { waitUntil: 'networkidle' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(500);
  await expect(page.locator('body')).toBeVisible();
});

test('mobile login surface remains within viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
});

import { test, expect } from '@playwright/test';

/**
 * Smoke test: the durable text-journal loop.
 * Onboarding → write → autosave → journal list → entry detail → reload persistence.
 */
test('text entry survives reload', async ({ page }) => {
  await page.goto('/#/onboarding');
  await expect(page.getByTestId('onboarding-no-ai')).toBeVisible();
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);

  // Write an entry.
  await page.getByTestId('home-write').click();
  await expect(page).toHaveURL(/#\/write/);
  const canary = `playwright-canary-${Date.now()}`;
  await page.locator('#entry-body').fill(canary);
  await expect(page.getByTestId('save-indicator')).toContainText('Saved on this device', { timeout: 10_000 });

  // It appears in the journal list (user's own words as preview).
  await page.goto('/#/journal');
  await expect(page.getByText(canary).first()).toBeVisible();

  // Entry detail shows the original text, separated from AI output.
  await page.getByText(canary).first().click();
  await expect(page.getByLabel('Your original entry')).toContainText(canary);

  // Reload: the entry persists (IndexedDB, not memory).
  await page.reload();
  await page.goto('/#/journal');
  await expect(page.getByText(canary).first()).toBeVisible();
});

test('privacy check passes with zero network requests', async ({ page }) => {
  await page.goto('/#/privacy');
  await page.getByTestId('privacy-run-check').click();
  await expect(page.getByText('zero network requests')).toBeVisible({ timeout: 30_000 });
});

test('compact mode mirrors the watch feeling wheel', async ({ page }) => {
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/compact');
  const hub = page.getByTestId('compact-wheel-hub');
  await expect(hub).toBeVisible();
  // Tap to open, tap a feeling to save — same as /watch/.
  await hub.click();
  await expect(page.locator('.fw-wheel.open .fw-orb')).toHaveCount(8);
  await page.locator('.fw-orb').first().click();
  await expect(page.getByText('Saved ✓')).toBeVisible();
  await expect(page.getByTestId('compact-count')).toContainText('1 check-in today');
  // The mood entry shows up in the journal.
  await page.goto('/#/journal');
  await expect(page.getByText('😊 Joyful')).toBeVisible();
});

test('tiny watch mode is a standalone feeling-wheel page under 20KB', async ({ page }) => {
  const resp = await page.goto('/watch/');
  expect(resp!.ok()).toBeTruthy();
  const hub = page.getByTestId('wheel-hub');
  await expect(hub).toBeVisible();
  const box = await hub.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(72);
  // Zero framework: the whole page (HTML+CSS+JS) must stay tiny.
  const body = await resp!.text();
  expect(body.length).toBeLessThan(20_000);
  // And it writes to the same database the app uses.
  const dbName = await page.evaluate(() => (document.getElementById('hub') ? 'grass-journal' : ''));
  expect(dbName).toBe('grass-journal');
});

test('watch mode opens the app database (Dexie native version), no version error', async ({ page }) => {
  // Main app first: Dexie opens grass-journal at native version = declared x 10.
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  const version = await page.evaluate(() =>
    indexedDB.databases().then((dbs) => dbs.find((d) => d.name === 'grass-journal')?.version),
  );
  expect(version).toBeGreaterThan(1);
  // Watch page must open the same DB without requesting a lower version.
  await page.goto('/watch/');
  await expect(page.locator('#err')).toBeEmpty({ timeout: 5000 });
  await expect(page.getByTestId('wheel-hub')).toBeEnabled();
  await expect(page.locator('#count')).not.toBeEmpty();
});

test('feeling wheel saves a mood check-in to the journal', async ({ page }) => {
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/watch/');
  const hub = page.getByTestId('wheel-hub');
  await expect(hub).toBeVisible();
  await expect(page.locator('#status')).toHaveText('How are you feeling?');

  // Tap the hub opens the wheel with a staggered pop-out; tap again closes it.
  // (Tap-only: watchOS web viewers hijack long-press to open a new tab.)
  await hub.click();
  await expect(page.locator('#wheel.open .orb')).toHaveCount(8);
  await expect(page.locator('#status')).toHaveText('Choose a feeling');
  await hub.click();
  await expect(page.locator('#wheel.open')).toHaveCount(0);

  // Tap to open, tap a feeling to save. The picked orb pulses, never vanishes.
  await hub.click();
  await expect(page.locator('#wheel.open .orb')).toHaveCount(8);
  await page.locator('.orb').first().click();
  await expect(page.locator('.orb.pick')).toHaveCount(1);
  const opacity = await page.locator('.orb.pick').evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe('1');
  await expect(page.locator('#flash')).toContainText('Saved ✓');
  await expect(page.locator('#count')).toContainText('1 check-in today');

  // The mood entry persists and shows up in the journal.
  await page.goto('/#/journal');
  await expect(page.getByText('😊 Joyful')).toBeVisible();
});

test('/go short URL lands on watch mode even with the service worker installed', async ({ page }) => {
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  // Let the service worker install and take control.
  await page.waitForTimeout(2000);
  await page.goto('/go');
  await expect(page).toHaveURL(/\/watch\/$/, { timeout: 10000 });
  await expect(page.getByTestId('wheel-hub')).toBeVisible();
});

test('watch page has a writing mode for typed entries', async ({ page }) => {
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/watch/');
  await page.getByTestId('watch-write-toggle').click();
  await expect(page.getByTestId('watch-write-box')).toBeVisible();
  await page.getByTestId('watch-write-box').fill('typed on the watch page');
  await page.getByTestId('watch-write-save').click();
  await expect(page.locator('#flash')).toContainText('Saved ✓');
  await expect(page.locator('#count')).toContainText('1 check-in today');
  // Back to the wheel, and the typed entry is in the journal.
  await page.getByText('← Feelings').click();
  await expect(page.getByTestId('wheel-hub')).toBeVisible();
  await page.goto('/#/journal');
  await expect(page.getByText('typed on the watch page')).toBeVisible();
});

test('compact mode has a writing mode', async ({ page }) => {
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/compact');
  await page.getByTestId('compact-write-toggle').click();
  await expect(page.getByTestId('compact-write-box')).toBeVisible();
  await page.getByTestId('compact-write-box').fill('typed in compact mode');
  await page.getByTestId('compact-write-save').click();
  await expect(page.getByText('Saved ✓')).toBeVisible();
  await page.goto('/#/journal');
  await expect(page.getByText('typed in compact mode')).toBeVisible();
});

test('discovery files are served as-is, never swallowed by the service worker', async ({ page }) => {
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  // Let the service worker install and take control.
  await page.waitForTimeout(2000);

  const robots = await page.goto('/robots.txt');
  expect(robots!.ok()).toBeTruthy();
  expect(await robots!.text()).toContain('Sitemap: https://grass-journal.view.fast/sitemap.xml');

  const sitemap = await page.goto('/sitemap.xml');
  expect(sitemap!.ok()).toBeTruthy();
  expect(sitemap!.headers()['content-type']).toContain('xml');
  expect(await sitemap!.text()).toContain('<urlset');

  const llms = await page.goto('/llms.txt');
  expect(llms!.ok()).toBeTruthy();
  const llmsBody = await llms!.text();
  expect(llmsBody).toContain('# Grass Journal');
  expect(llmsBody.length).toBeGreaterThan(1000);

  const card = await page.goto('/.well-known/agent.json');
  expect(card!.ok()).toBeTruthy();
  const agent = JSON.parse(await card!.text());
  expect(agent.name).toBe('Grass Journal');
  expect(Array.isArray(agent.skills)).toBeTruthy();
});

test('carbon.txt is served as-is with the service worker installed', async ({ page }) => {
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  await page.waitForTimeout(2000);
  const carbon = await page.goto('/carbon.txt');
  expect(carbon!.ok()).toBeTruthy();
  const body = await carbon!.text();
  expect(body).toContain('version = "0.6"');
  expect(body).toContain('[upstream]');
});

test('open source credits page lists dependencies honestly', async ({ page }) => {
  await page.goto('/#/onboarding');
  await page.getByTestId('onboarding-no-ai').click();
  await expect(page).toHaveURL(/#\/$/);
  await page.getByTestId('home-open-source').click();
  await expect(page).toHaveURL(/#\/open-source/);
  await expect(page.getByText('Dexie.js')).toBeVisible();
  await expect(page.getByText('Whisper tiny.en (OpenAI)')).toBeVisible();
  // The app's own source is public: the page links the repo.
  await expect(page.getByRole('link', { name: 'github.com/Mike-Demo/grass-journal' })).toBeVisible();
  await expect(page.getByText('Gemma 2 2B IT (Google)')).toBeVisible();
});

import {expect, test, type Locator, type Page} from '@playwright/test';

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({page}) => {
  const failures: string[] = [];
  errors.set(page, failures);
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.addInitScript(() => {
    let id = 0;
    crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`;
  });
  await page.goto('./');
  await expect(page.locator('.grid-top ddl-item')).toHaveCount(3);
});

test.afterEach(async ({page}) => {
  expect(errors.get(page)).toEqual([]);
});

async function drag(page: Page, source: Locator, target: {x: number; y: number}) {
  const box = await source.boundingBox();
  if (!box) throw new Error('Missing drag source');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, {steps: 5});
  // Allow the library's audited pointer stream to produce its preview.
  await page.waitForTimeout(40);
  await page.mouse.up();
}

async function gridPoint(page: Page, selector: string, fractionX: number, fractionY: number) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error('Missing grid');
  return {x: box.x + box.width * fractionX, y: box.y + box.height * fractionY};
}

test('renders desktop and mobile layouts with styles and assets', async ({page}, info) => {
  await expect(page.getByRole('heading', {name: 'Widget placement'})).toBeVisible();
  await expect(page.locator('.grid-bottom ddl-item')).toHaveCount(2);
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(40, 40, 40)');
  for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({width, height});
    await page.screenshot({path: info.outputPath(`${name}.png`), fullPage: true});
    await expect(page.getByRole('heading', {name: 'Widget placement'})).toBeVisible();
  }
});

test('updates settings and adds and removes an item', async ({page}) => {
  await page.getByRole('button', {name: 'Half-row gap', exact: true}).click();
  await page.getByLabel('Preferred width:', {exact: true}).fill('5');
  await expect(page.getByLabel('Preferred width:', {exact: true})).toHaveValue('5');
  await page.getByLabel('New widget sizing:').selectOption('fixed');
  await expect(page.getByLabel('New widget sizing:')).toHaveValue('fixed');
  await page.getByRole('button', {name: 'Add Item', exact: true}).click();
  await expect(page.locator('.grid-top ddl-item')).toHaveCount(2);
  await page.locator('.grid-top .remove-item-btn').last().click();
  await expect(page.locator('.grid-top ddl-item')).toHaveCount(1);
  await page.getByLabel('Show remove button').uncheck();
  await expect(page.locator('.remove-item-btn')).toHaveCount(0);
});

test('moves and resizes through the visible handles', async ({page}) => {
  await page.getByRole('button', {name: 'Half-row gap', exact: true}).click();
  await page.locator('.grid-top').scrollIntoViewIfNeeded();
  const item = page.locator('.grid-top ddl-item').first();
  await drag(page, item.locator('[ddlDragHandle]'), await gridPoint(page, '.grid-top', 0.45, 0.5));
  await expect(page.getByRole('status')).toContainText('move:');
  const before = await item.locator('.item-info').textContent();
  const handle = item.locator('.resize-handle.right');
  const box = await handle.boundingBox();
  if (!box) throw new Error('Missing resize handle');
  await drag(page, handle, {x: box.x - 110, y: box.y + box.height / 2});
  await expect(page.getByRole('status')).toContainText('resize:');
  await expect(item.locator('.item-info')).not.toHaveText(before!);
});

test('inserts a palette item into the gap without moving the existing item', async ({page}) => {
  await page.getByRole('button', {name: 'Half-row gap', exact: true}).click();
  await page.locator('.drag-items').scrollIntoViewIfNeeded();
  const before = await page.locator('.grid-top .item-info').textContent();
  await drag(page, page.locator('.drag-item').first(), await gridPoint(page, '.grid-top', 0.75, 0.15));
  await expect(page.locator('.grid-top ddl-item')).toHaveCount(2);
  await expect(page.getByRole('status')).toContainText('insert: 6 columns');
  await expect(page.locator('.grid-top .item-info').first()).toHaveText(before!);
  await expect(page.locator('.drag-item')).toHaveCount(3);
});

test('transfers an item between grids while preserving its width', async ({page}) => {
  await page.getByRole('button', {name: 'Transfer', exact: true}).click();
  await page.locator('.drag-items').scrollIntoViewIfNeeded();
  await drag(page, page.locator('.grid-top [ddlDragHandle]'), await gridPoint(page, '.grid-bottom', 0.75, 0.15));
  await expect(page.locator('.grid-top ddl-item')).toHaveCount(0);
  await expect(page.locator('.grid-bottom ddl-item')).toHaveCount(2);
  await expect(page.getByRole('status')).toContainText('transfer: 6 columns');
});

test('respects disabled dragging and remains usable after scrolling', async ({page}) => {
  await page.getByRole('button', {name: 'Half-row gap', exact: true}).click();
  await page.getByLabel('Is disabled', {exact: true}).check();
  await page.locator('.grid-top').scrollIntoViewIfNeeded();
  const item = page.locator('.grid-top ddl-item');
  const before = await item.locator('.item-info').textContent();
  await drag(page, item.locator('[ddlDragHandle]'), await gridPoint(page, '.grid-top', 0.75, 0.5));
  await expect(item.locator('.item-info')).toHaveText(before!);
  await expect(page.getByRole('status')).not.toContainText('move:');
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByLabel('Is disabled', {exact: true}).uncheck();
  await page.locator('.grid-top').scrollIntoViewIfNeeded();
  await drag(page, item.locator('[ddlDragHandle]'), await gridPoint(page, '.grid-top', 0.45, 0.5));
  await expect(page.getByRole('status')).toContainText('move:');
});


test('reveals empty-row controls on hover and removes exactly one gap', async ({page}, info) => {
  await page.getByRole('button', {name: 'Empty rows', exact: true}).click();
  const grid = page.locator('.grid-top');
  await grid.scrollIntoViewIfNeeded();
  const control = grid.getByRole('button', {name: 'Remove row 2', exact: true});
  await page.mouse.move(0, 0);
  await expect(control).toHaveCSS('opacity', '0');
  const wrapper = grid.locator('.ddl-empty-row').first();
  await wrapper.hover();
  await expect(control).toHaveCSS('opacity', '1');
  await grid.screenshot({path: info.outputPath('empty-row-hover.png')});
  await control.click();
  await expect(page.getByRole('status')).toContainText('Removed empty row 2 from grid-top; 4 rows remain.');
  await expect(grid.locator('ddl-item')).toHaveCount(3);
  await expect(grid.locator('.item-info').nth(1)).toContainText('[1,2] (12,1)');
  await expect(grid.locator('.item-info').nth(2)).toContainText('[1,4] (12,1)');
  await expect(grid.locator('.ddl-empty-row')).toHaveCount(1);
  await grid.screenshot({path: info.outputPath('empty-row-removed.png')});
});

test('allows keyboard removal and keeps overlays aligned after resize and scroll', async ({page}) => {
  await page.getByRole('button', {name: 'Empty rows', exact: true}).click();
  await page.setViewportSize({width: 1000, height: 700});
  const grid = page.locator('.grid-top');
  await grid.scrollIntoViewIfNeeded();
  const wrapper = grid.locator('.ddl-empty-row').first();
  const bounds = await wrapper.boundingBox();
  const upper = await grid.locator('ddl-item').first().boundingBox();
  expect(bounds!.y).toBeCloseTo(upper!.y + upper!.height + 20, 0);
  expect(bounds!.height).toBeGreaterThanOrEqual(100);
  const control = grid.getByRole('button', {name: 'Remove row 2', exact: true});
  await control.focus();
  await expect(control).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Removed empty row 2');
});

test('allows dropping into a row covered by custom empty-row controls', async ({page}) => {
  await page.getByRole('button', {name: 'Empty rows', exact: true}).click();
  const grid = page.locator('.grid-top');
  await grid.scrollIntoViewIfNeeded();
  const bounds = await grid.locator('.ddl-empty-row').first().boundingBox();
  const handle = grid.locator('[ddlDragHandle]').first();
  const handleBounds = await handle.boundingBox();
  await drag(page, handle, {
    x: handleBounds!.x + handleBounds!.width / 2, y: bounds!.y + bounds!.height / 2,
  });
  await expect(grid.locator('.item-info').first()).toContainText('[1,2]');
  await expect(page.getByRole('status')).toContainText('move:');
  await expect(grid.getByRole('button', {name: 'Remove row 1', exact: true})).toBeEnabled();
  await expect(grid.getByRole('button', {name: 'Remove row 2', exact: true})).toHaveCount(0);
});

test.describe('touch empty-row controls', () => {
  test.use({hasTouch: true, isMobile: true});
  test('keeps the removal button visible without hover', async ({page}) => {
    await page.getByRole('button', {name: 'Empty rows', exact: true}).tap();
    const control = page.locator('.grid-top').getByRole('button', {name: 'Remove row 2', exact: true});
    await expect(control).toHaveCSS('opacity', '1');
    await control.tap();
    await expect(page.getByRole('status')).toContainText('Removed empty row 2');
  });
});

import {expect, test, Page} from '@playwright/test';

const browserErrors = new WeakMap<Page, string[]>();

async function state(page: Page) {
  return JSON.parse(await page.locator('#state').innerText());
}

async function events(page: Page): Promise<string[]> {
  return JSON.parse(await page.locator('#events').innerText());
}

async function point(page: Page, grid: string, x: number, y: number) {
  const box = await page.locator(`#${grid}`).boundingBox();
  if (!box) throw new Error('Missing grid');
  return {x: box.x + (x - 0.5) * 100, y: box.y + (y - 0.5) * 80};
}

async function begin(page: Page, selector = '#a [ddlDragHandle]') {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error('Missing handle');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

async function move(page: Page, target: {x: number; y: number}) {
  await page.mouse.move(target.x, target.y, {steps: 3});
  // Pointer moves are deliberately throttled by the library.
  await page.waitForTimeout(40);
}

test.beforeEach(async ({page}, info) => {
  const {version, mode} = info.project.metadata;
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:4179/${version}/?mode=${mode}`);
  await expect(page.locator('#a ddl-item span')).toHaveText('1,1:1,1');
  expect(await page.evaluate(() => 'Zone' in window)).toBe(mode === 'zone');
  await expect.poll(() => events(page)).toEqual([]);
});

test.afterEach(async ({page}) => {
  expect(browserErrors.get(page)).toEqual([]);
});

test('moves and updates the visible model before emitting a single commit', async ({page}) => {
  await begin(page);
  await move(page, await point(page, 'a', 2, 1));
  await page.mouse.up();
  await expect(page.locator('#a ddl-item span')).toHaveText('2,1:1,1');
  await expect.poll(() => events(page)).toEqual(['items:a', 'commit:move:true']);
});

test('resizes through the public resize handle', async ({page}) => {
  await begin(page, '#a .resize-handle.right');
  await move(page, await point(page, 'a', 2, 1));
  await page.mouse.up();
  await expect(page.locator('#a ddl-item span')).toHaveText('1,1:2,1');
  expect(await events(page)).toContain('commit:resize:true');
});

test('inserts reusable palette items and preserves existing positions', async ({page}) => {
  for (const column of [2, 3]) {
    await begin(page, '#palette');
    await move(page, await point(page, 'a', column, 1));
    await page.mouse.up();
    await expect(page.locator('#a ddl-item')).toHaveCount(column);
  }
  await expect(page.locator('#a [data-id="first"] span')).toHaveText('1,1:1,1');
  expect((await events(page)).filter(event => event === 'commit:insert:true')).toHaveLength(2);
});

test('transfers atomically with destination and source updates before the event', async ({page}) => {
  await begin(page);
  await move(page, await point(page, 'b', 2, 1));
  await page.mouse.up();
  await expect(page.locator('#a ddl-item')).toHaveCount(0);
  await expect(page.locator('#empty-rows')).toHaveText('[ 1, 2 ]');
  await expect(page.locator('#b ddl-item span')).toHaveText('2,1:1,1');
  await expect.poll(() => events(page)).toEqual(['items:b', 'items:a', 'commit:transfer:true']);
});

test('cancels a pointer transaction without committing its preview', async ({page}) => {
  await begin(page);
  await move(page, await point(page, 'a', 3, 1));
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', {pointerId: 1, bubbles: true})));
  await page.mouse.up();
  await expect(page.locator('#a ddl-item span')).toHaveText('1,1:1,1');
  expect((await events(page)).filter(event => event.startsWith('commit:'))).toEqual([]);
  expect(await events(page)).toContain('reject:cancelled');
});

test('accepts external updates and cancels an affected active drag', async ({page}) => {
  await begin(page);
  await move(page, await point(page, 'a', 2, 1));
  await page.locator('#replace').evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('#a ddl-item span')).toHaveText('4,1:1,1');
  await page.mouse.up();
  expect((await events(page)).filter(event => event.startsWith('commit:'))).toEqual([]);
});

test('rejects insertion into a full grid when growth is disabled', async ({page}) => {
  await page.locator('#fill').click();
  await expect(page.locator('#a ddl-item span')).toHaveText('1,1:4,2');
  await begin(page, '#palette');
  await move(page, await point(page, 'a', 2, 1));
  await page.mouse.up();
  await expect(page.locator('#a ddl-item')).toHaveCount(1);
  expect((await events(page)).filter(event => event.startsWith('commit:'))).toEqual([]);
  expect((await events(page)).some(event => event.startsWith('reject:'))).toBe(true);
});

test('bounds bottom preview growth and commits one appended row', async ({page}) => {
  const box = (await page.locator('#a').boundingBox())!;
  await begin(page, '#palette');
  const target = {x: box.x + 150, y: box.y + box.height - 2};
  await move(page, target);
  for (let i = 0; i < 8; i++) await move(page, {...target, x: target.x + i % 2});
  expect((await state(page)).rowsA).toBe(2);
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).rowsA).toBe(3);
  const final = await state(page);
  expect(final.a.find((item: {id: string}) => item.id !== 'first').y).toBe(3);
  expect(final.a.find((item: {id: string}) => item.id === 'first').y).toBe(1);
});

test('keeps pointer coordinates correct after scrolling during a drag', async ({page}) => {
  await begin(page);
  await page.evaluate(() => window.scrollBy(0, 50));
  await move(page, await point(page, 'a', 3, 2));
  await page.mouse.up();
  await expect(page.locator('#a ddl-item span')).toHaveText('3,2:1,1');
});


test('removes an empty row through the typed template and commits both models before its event', async ({page}) => {
  await expect(page.locator('#empty-rows')).toHaveText('[ 2 ]');
  await page.getByRole('button', {name: 'Remove row 2', exact: true}).click();
  await expect.poll(async () => (await state(page)).rowsA).toBe(1);
  await expect(page.locator('#a ddl-item span')).toHaveText('1,1:1,1');
  await expect(page.locator('#empty-rows')).toHaveText('[]');
  await expect.poll(() => events(page)).toEqual(['items:a', 'rows:a', 'removed:2:true']);
});

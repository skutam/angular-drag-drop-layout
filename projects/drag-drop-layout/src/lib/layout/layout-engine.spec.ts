import {describe, it, expect} from 'vitest';
import {GridItem} from '../item/item.definitions';
import {LayoutEngine, overlaps, validPriority} from './layout-engine';
import {MoveDirection, PlacementRequest} from './layout.definitions';

describe('LayoutEngine', () => {
  const engine = new LayoutEngine();
  const item = (id: string, x: number, y: number, width = 1, height = 1): GridItem =>
    Object.freeze({id, x, y, width, height});
  const request = (
    items: readonly GridItem[],
    active: GridItem,
    overrides: Partial<PlacementRequest> = {},
  ): PlacementRequest => ({
    items,
    active,
    columns: 4,
    rows: 4,
    operation: 'move',
    movePriority: ['top', 'left', 'right', 'bottom'],
    allowRowGrowth: true,
    ...overrides,
  });

  it('keeps the active proposal fixed and moves its blocker by priority', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 2, 2), item('blocker', 2, 2)],
      item('active', 2, 2),
    ));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.find((entry) => entry.id === 'active')).toEqual(item('active', 2, 2));
    expect(result.items.find((entry) => entry.id === 'blocker')).toEqual(item('blocker', 2, 1));
  });

  it('uses direction order to break ties between equally disruptive placements', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 1), item('blocker', 1, 1)],
      item('active', 1, 1),
      {movePriority: ['left', 'right', 'bottom']},
    ));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items.find((entry) => entry.id === 'blocker')?.x).toBe(2);
  });

  it('moves a blocker by the minimum distance needed to clear a wide active item', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 1, 2), item('blocker', 2, 1, 2)],
      item('active', 1, 1, 2),
      {movePriority: ['right']},
    ));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items.find((entry) => entry.id === 'blocker')?.x).toBe(3);
  });

  it('resolves a recursive cascade in stable item order', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 1), item('first', 1, 1), item('second', 2, 1)],
      item('active', 1, 1),
      {movePriority: ['right']},
    ));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((entry) => `${entry.id}:${entry.x}`)).toEqual(['active:1', 'first:2', 'second:3']);
  });

  it('backtracks to a later direction when a cascade is blocked', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 2, 2), item('blocker', 2, 2), item('wall', 1, 1, 4, 1)],
      item('active', 2, 2),
      {movePriority: ['top', 'left', 'right'], columns: 4, rows: 3},
    ));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items.find((entry) => entry.id === 'blocker')?.x).toBe(1);
  });

  it('rejects atomically when no branch can clear all collisions', () => {
    const original = [item('active', 1, 1), item('blocker', 1, 1)];
    const result = engine.resolvePlacement(request(original, item('active', 1, 1), {
      columns: 1,
      rows: 1,
      movePriority: ['top', 'left', 'right'],
      allowRowGrowth: false,
    }));
    expect(result).toEqual(expect.objectContaining({ok: false, reason: 'no-space'}));
    expect(original).toEqual([item('active', 1, 1), item('blocker', 1, 1)]);
  });

  it('requires bottom priority as well as allowRowGrowth before growing', () => {
    const withoutBottom = engine.resolvePlacement(request(
      [item('active', 1, 1), item('blocker', 1, 1)],
      item('active', 1, 1),
      {columns: 1, rows: 1, movePriority: ['top'], allowRowGrowth: true},
    ));
    const disabled = engine.resolvePlacement(request(
      [item('active', 1, 1), item('blocker', 1, 1)],
      item('active', 1, 1),
      {columns: 1, rows: 1, movePriority: ['bottom'], allowRowGrowth: false},
    ));
    expect(withoutBottom.ok).toBe(false);
    expect(disabled.ok).toBe(false);
  });

  it('adds only the rows required by a bottom displacement', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 2), item('blocker', 1, 2, 1, 2)],
      item('active', 1, 2),
      {columns: 1, rows: 3, movePriority: ['bottom']},
    ));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toBe(4);
  });

  it('keeps an insertion at the requested row even when moving the blocker grows more', () => {
    const result = engine.resolvePlacement(request(
      [item('blocker', 1, 1, 1, 2)],
      item('new', 1, 2),
      {
        columns: 1,
        rows: 2,
        operation: 'insert',
        movePriority: ['bottom'],
      },
    ));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toBe(4);
    expect(result.items.find((entry) => entry.id === 'new')?.y).toBe(2);
    expect(result.items.find((entry) => entry.id === 'blocker')?.y).toBe(3);
  });

  it('inserts into the middle of a full grid and cascades original items downward', () => {
    const result = engine.resolvePlacement(request(
      [item('a', 1, 1), item('b', 1, 2), item('c', 1, 3), item('d', 1, 4)],
      item('new', 1, 2),
      {columns: 1, rows: 4, operation: 'insert'},
    ));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toBe(5);
    expect(result.items.map((entry) => `${entry.id}:${entry.y}`))
      .toEqual(['a:1', 'b:3', 'c:4', 'd:5', 'new:2']);
  });

  it('moves a later item between original tall blockers and grows the cascade', () => {
    const result = engine.resolvePlacement(request(
      [item('a', 1, 1, 1, 2), item('b', 1, 3, 1, 2), item('new', 1, 5)],
      item('new', 1, 2),
      {columns: 1, rows: 5, operation: 'move'},
    ));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toBe(6);
    expect(result.items.find((entry) => entry.id === 'new')?.y).toBe(2);
    expect(result.items.find((entry) => entry.id === 'a')?.y).toBe(3);
    expect(result.items.find((entry) => entry.id === 'b')?.y).toBe(5);
  });

  it('does not automatically remove existing rows', () => {
    const result = engine.resolvePlacement(request([], item('active', 1, 1), {rows: 8}));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toBe(8);
  });

  it('normalizes in input order so later items win their requested position', () => {
    const result = engine.normalize({
      columns: 3,
      rows: 2,
      items: [item('first', 1, 1), item('later', 1, 1)],
    }, ['right', 'bottom'], true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.find((entry) => entry.id === 'later')).toEqual(item('later', 1, 1));
    expect(result.items.find((entry) => entry.id === 'first')?.x).toBe(2);
  });

  it('rejects duplicate ids and malformed items', () => {
    const duplicate = engine.normalize({
      columns: 2,
      rows: 2,
      items: [item('same', 1, 1), item('same', 2, 1)],
    }, ['bottom'], true);
    const invalid = engine.resolvePlacement(request([], item('bad', 0, 1)));
    expect(duplicate).toEqual(expect.objectContaining({ok: false, reason: 'duplicate-item-id'}));
    expect(invalid).toEqual(expect.objectContaining({ok: false, reason: 'invalid-item'}));
  });

  it('validates direction lists as non-empty and duplicate-free', () => {
    expect(validPriority([])).toBe(false);
    expect(validPriority(['top', 'top'])).toBe(false);
    expect(validPriority(['top', 'bottom'])).toBe(true);
    expect(validPriority(['sideways'] as unknown as MoveDirection[])).toBe(false);
  });

  it('uses inclusive grid rectangles for overlap checks', () => {
    expect(overlaps(item('a', 1, 1), item('b', 2, 1))).toBe(false);
    expect(overlaps(item('a', 1, 1, 2), item('b', 2, 1))).toBe(true);
  });

  it('rejects duplicate active IDs instead of returning repeated copies of the proposal', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 1), item('active', 2, 1)], item('active', 3, 1),
    ));
    expect(result).toEqual(expect.objectContaining({ok: false, reason: 'duplicate-item-id'}));
  });

  it('prefers one longer displacement over a shorter cascade', () => {
    const result = engine.resolvePlacement(request(
      [item('blocker', 2, 2), item('above', 2, 1)], item('new', 2, 2, 2),
      {movePriority: ['top', 'right']},
    ));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.find((entry) => entry.id === 'blocker')).toEqual(item('blocker', 4, 2));
    expect(result.items.find((entry) => entry.id === 'above')).toEqual(item('above', 2, 1));
  });

  it('uses total distance before direction preference when the moved count is equal', () => {
    const result = engine.resolvePlacement(request(
      [item('blocker', 2, 3)], item('new', 2, 2, 1, 2), {movePriority: ['top', 'right']},
    ));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items.find((entry) => entry.id === 'blocker')).toEqual(item('blocker', 3, 3));
  });

  it('prefers a cascade within existing rows over growth moving only one item', () => {
    const result = engine.resolvePlacement(request(
      [item('blocker', 2, 1), item('neighbor', 3, 1)], item('new', 2, 1),
      {rows: 1, movePriority: ['bottom', 'right']},
    ));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toBe(1);
    expect(result.items.map((entry) => entry.x)).toEqual([3, 4, 2]);
  });

  it('minimizes additional rows across complete growth cascades', () => {
    const result = engine.resolvePlacement(request([
      item('a', 1, 3, 2), item('b', 3, 3, 2, 2), item('c', 2, 1),
      item('d', 4, 1, 1, 2), item('e', 1, 2), item('f', 3, 1, 1, 2), item('g', 1, 4),
    ], item('new', 2, 2, 2, 2), {movePriority: ['bottom', 'left', 'right', 'top']}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The first downward cascade needs seven rows; another fits in five.
    expect(result.rows).toBe(5);
    expect(result.items.find((entry) => entry.id === 'new')).toEqual(item('new', 2, 2, 2, 2));
    expect(result.items.every((entry, index) => result.items.slice(index + 1).every((other) => !overlaps(entry, other))))
      .toBe(true);
  });

  it('returns the best complete result already found when the budget ends', () => {
    const result = new LayoutEngine(1).resolvePlacement(request(
      [item('blocker', 2, 2)], item('new', 2, 2), {movePriority: ['right', 'bottom']},
    ));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items[0]).toEqual(item('blocker', 3, 2));
  });

  it('distinguishes an exhausted budget from an exhausted candidate search', () => {
    const input = request([item('blocker', 1, 1)], item('new', 1, 1), {
      columns: 2, rows: 2, allowRowGrowth: false, movePriority: ['top', 'left'],
    });
    expect(new LayoutEngine(1).resolvePlacement(input))
      .toEqual(expect.objectContaining({ok: false, reason: 'search-limit'}));
    expect(new LayoutEngine(4).resolvePlacement(input))
      .toEqual(expect.objectContaining({ok: false, reason: 'no-space'}));
  });

  it('gives growth a separate budget when the existing-row search is truncated', () => {
    const result = new LayoutEngine(1).resolvePlacement(request(
      [item('blocker', 1, 1)], item('new', 1, 1),
      {rows: 1, columns: 2, movePriority: ['bottom', 'right']},
    ));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toBe(2);
  });

  it('repeats the same bounded search deterministically', () => {
    const input = request([item('a', 2, 2), item('b', 2, 1), item('c', 3, 2)], item('new', 2, 2));
    const bounded = new LayoutEngine(12);
    expect(bounded.resolvePlacement(input)).toEqual(bounded.resolvePlacement(input));
  });
});

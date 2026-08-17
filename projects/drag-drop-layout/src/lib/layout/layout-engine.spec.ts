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
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.items.find((entry) => entry.id === 'active')).toEqual(item('active', 2, 2));
    expect(result.items.find((entry) => entry.id === 'blocker')).toEqual(item('blocker', 2, 1));
  });

  it('uses the first available configured direction', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 1), item('blocker', 1, 1)],
      item('active', 1, 1),
      {movePriority: ['left', 'right', 'bottom']},
    ));
    expect(result.ok).toBeTrue();
    if (result.ok) expect(result.items.find((entry) => entry.id === 'blocker')?.x).toBe(2);
  });

  it('moves a blocker by the minimum distance needed to clear a wide active item', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 1, 2), item('blocker', 2, 1, 2)],
      item('active', 1, 1, 2),
      {movePriority: ['right']},
    ));
    expect(result.ok).toBeTrue();
    if (result.ok) expect(result.items.find((entry) => entry.id === 'blocker')?.x).toBe(3);
  });

  it('resolves a recursive cascade in stable item order', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 1), item('first', 1, 1), item('second', 2, 1)],
      item('active', 1, 1),
      {movePriority: ['right']},
    ));
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.items.map((entry) => `${entry.id}:${entry.x}`)).toEqual(['active:1', 'first:2', 'second:3']);
  });

  it('backtracks to a later direction when a cascade is blocked', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 2, 2), item('blocker', 2, 2), item('wall', 1, 1, 4, 1)],
      item('active', 2, 2),
      {movePriority: ['top', 'left', 'right'], columns: 4, rows: 3},
    ));
    expect(result.ok).toBeTrue();
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
    expect(result).toEqual(jasmine.objectContaining({ok: false, reason: 'no-space'}));
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
    expect(withoutBottom.ok).toBeFalse();
    expect(disabled.ok).toBeFalse();
  });

  it('adds only the rows required by a bottom displacement', () => {
    const result = engine.resolvePlacement(request(
      [item('active', 1, 2), item('blocker', 1, 2, 1, 2)],
      item('active', 1, 2),
      {columns: 1, rows: 3, movePriority: ['bottom']},
    ));
    expect(result.ok).toBeTrue();
    if (result.ok) expect(result.rows).toBe(4);
  });

  it('places a one-row insertion below a two-row last blocker when that grows less', () => {
    const result = engine.resolvePlacement(request(
      [item('blocker', 1, 1, 1, 2)],
      item('new', 1, 2),
      {
        columns: 1,
        rows: 2,
        operation: 'insert',
        movePriority: ['bottom'],
        mayRelocateActive: true,
      },
    ));
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.rows).toBe(3);
    expect(result.items.find((entry) => entry.id === 'new')?.y).toBe(3);
    expect(result.items.find((entry) => entry.id === 'blocker')?.y).toBe(1);
  });

  it('does not automatically remove existing rows', () => {
    const result = engine.resolvePlacement(request([], item('active', 1, 1), {rows: 8}));
    expect(result.ok).toBeTrue();
    if (result.ok) expect(result.rows).toBe(8);
  });

  it('normalizes in input order so later items win their requested position', () => {
    const result = engine.normalize({
      columns: 3,
      rows: 2,
      items: [item('first', 1, 1), item('later', 1, 1)],
    }, ['right', 'bottom'], true);
    expect(result.ok).toBeTrue();
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
    expect(duplicate).toEqual(jasmine.objectContaining({ok: false, reason: 'duplicate-item-id'}));
    expect(invalid).toEqual(jasmine.objectContaining({ok: false, reason: 'invalid-item'}));
  });

  it('validates direction lists as non-empty and duplicate-free', () => {
    expect(validPriority([])).toBeFalse();
    expect(validPriority(['top', 'top'])).toBeFalse();
    expect(validPriority(['top', 'bottom'])).toBeTrue();
    expect(validPriority(['sideways'] as unknown as MoveDirection[])).toBeFalse();
  });

  it('uses inclusive grid rectangles for overlap checks', () => {
    expect(overlaps(item('a', 1, 1), item('b', 2, 1))).toBeFalse();
    expect(overlaps(item('a', 1, 1, 2), item('b', 2, 1))).toBeTrue();
  });
});

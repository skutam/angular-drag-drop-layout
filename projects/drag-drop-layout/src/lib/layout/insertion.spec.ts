import {GridItem} from '../item/item.definitions';
import {InsertionOptions, LayoutSnapshot} from './layout.definitions';
import {prepareInsertion} from './insertion';

describe('palette insertion sizing', () => {
  const preferred: GridItem = Object.freeze({id: 'new', x: 1, y: 1, width: 12, height: 1});
  const existing: GridItem = Object.freeze({id: 'existing', x: 1, y: 1, width: 6, height: 1});
  const snapshot: LayoutSnapshot = {items: [existing], columns: 12, rows: 3};

  it('fills the same half-row gap from any pointed column without changing existing items', () => {
    for (const column of [7, 9, 12]) {
      expect(prepareInsertion(snapshot, preferred, column, 1))
        .toEqual({ok: true, item: {...preferred, x: 7, width: 6}});
    }
    expect(snapshot.items).toEqual([existing]);
    expect(preferred.width).toBe(12);
  });

  it('uses the intersection of free space across the full height', () => {
    const tall = {...preferred, height: 2};
    const layout = {...snapshot, items: [existing, {...existing, id: 'lower', x: 10, y: 2, width: 3}]};
    expect(prepareInsertion(layout, tall, 8, 1)).toEqual({ok: true, item: {...tall, x: 7, width: 3}});
    // The pointed column is occupied on the second row, so normal pushing must handle it.
    expect(prepareInsertion(layout, tall, 11, 1)).toEqual({ok: true, item: tall});
  });

  it('falls back to preferred dimensions for occupied or undersized gaps', () => {
    expect(prepareInsertion(snapshot, preferred, 2, 1)).toEqual({ok: true, item: preferred});
    expect(prepareInsertion(snapshot, preferred, 9, 1, {sizing: 'fit-width', minWidth: 7}))
      .toEqual({ok: true, item: preferred});
  });

  it('caps fitting at preferred width and keeps the pointed column inside the result', () => {
    const small = {...preferred, width: 3};
    expect(prepareInsertion(snapshot, small, 8, 1)).toEqual({ok: true, item: {...small, x: 7}});
    expect(prepareInsertion(snapshot, small, 12, 1)).toEqual({ok: true, item: {...small, x: 10}});
  });

  it('restores preferred width when the same palette item enters an empty row', () => {
    prepareInsertion(snapshot, preferred, 9, 1);
    expect(prepareInsertion(snapshot, preferred, 9, 2))
      .toEqual({ok: true, item: {...preferred, y: 2}});
  });

  it('adapts to narrower grids but rejects destinations below the minimum', () => {
    const narrow = {...snapshot, items: [], columns: 4};
    expect(prepareInsertion(narrow, preferred, 3, 1)).toEqual({ok: true, item: {...preferred, width: 4}});
    expect(prepareInsertion(narrow, preferred, 3, 1, {sizing: 'fit-width', minWidth: 5}))
      .toEqual(jasmine.objectContaining({ok: false, reason: 'out-of-bounds'}));
  });

  it('preserves fixed dimensions and rejects a fixed widget wider than the destination', () => {
    const fixed: InsertionOptions = {sizing: 'fixed', minWidth: 1};
    expect(prepareInsertion(snapshot, preferred, 9, 1, fixed)).toEqual({ok: true, item: preferred});
    expect(prepareInsertion({...snapshot, columns: 6}, preferred, 3, 1, fixed))
      .toEqual(jasmine.objectContaining({ok: false, reason: 'out-of-bounds'}));
  });

  it('rejects malformed insertion settings and dimensions', () => {
    for (const minWidth of [0, -1, 1.5, 13, NaN]) {
      expect(prepareInsertion(snapshot, preferred, 7, 1, {sizing: 'fit-width', minWidth}))
        .toEqual(jasmine.objectContaining({ok: false, reason: 'invalid-config'}));
    }
    expect(prepareInsertion(snapshot, {...preferred, height: 0}, 7, 1))
      .toEqual(jasmine.objectContaining({ok: false, reason: 'invalid-item'}));
  });
});

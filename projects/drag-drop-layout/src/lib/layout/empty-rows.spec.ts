import {describe, expect, it} from 'vitest';
import {findEmptyRows, removeEmptyLayoutRow} from './empty-rows';
import {LayoutSnapshot} from './layout.definitions';

describe('empty rows', () => {
  const data = {label: 'Field'};
  const layout: LayoutSnapshot = {
    columns: 4, rows: 7,
    items: [
      Object.freeze({id: 'upper', x: 2, y: 2, width: 2, height: 2, data}),
      Object.freeze({id: 'lower', x: 1, y: 6, width: 4, height: 1, data}),
    ],
  };

  it('finds leading, consecutive internal and trailing rows while counting full item spans', () => {
    expect(findEmptyRows(layout)).toEqual([1, 4, 5, 7]);
  });

  it.each([1, 4, 5, 7])('removes only row %i and preserves all other item properties', row => {
    const result = removeEmptyLayoutRow(layout, row)!;
    expect(result.rows).toBe(6);
    expect(result.columns).toBe(4);
    expect(result.items).toEqual(layout.items.map(item => ({...item, y: item.y > row ? item.y - 1 : item.y})));
    expect(result.items.every(item => item.data === data)).toBe(true);
    expect(layout.items.map(item => item.y)).toEqual([2, 6]);
    expect(layout.rows).toBe(7);
  });

  it.each([0, -1, 8, 1.5, NaN, Infinity, 2, 3, 6])('rejects invalid or occupied row %s', row => {
    expect(removeEmptyLayoutRow(layout, row)).toBeNull();
  });

  it('retains the final empty row', () => {
    let empty: LayoutSnapshot = {columns: 4, rows: 3, items: []};
    empty = removeEmptyLayoutRow(empty, 2)!;
    empty = removeEmptyLayoutRow(empty, 1)!;
    expect(findEmptyRows(empty)).toEqual([1]);
    expect(removeEmptyLayoutRow(empty, 1)).toBeNull();
  });
});

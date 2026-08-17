import {GridGeometry, GridGeometrySnapshot} from './grid-geometry';
import {GridItem} from '../item/item.definitions';

describe('GridGeometry', () => {
  const geometry = new GridGeometry();
  const snapshot: GridGeometrySnapshot = {
    viewportLeft: 10,
    viewportTop: 20,
    width: 430,
    columnWidth: 100,
    columnGap: 10,
    rowGap: 5,
    rowHeights: [40, 60],
    fallbackRowHeight: 60,
    scroll: {x: 0, y: 100},
  };
  const item: GridItem = {id: 'item', x: 1, y: 1, width: 1, height: 1};

  it('keeps pointer mapping synchronized with scroll delta', () => {
    const before = geometry.itemAtPointer(snapshot, {x: 20, y: 30}, {x: 0, y: 100}, 4, item, {x: 0, y: 0});
    const after = geometry.itemAtPointer(snapshot, {x: 20, y: 30}, {x: 0, y: 145}, 4, item, {x: 0, y: 0});
    expect(before.y).toBe(1);
    expect(after.y).toBe(2);
  });

  it('finds the raw pointed cell independently of a full-width palette item', () => {
    expect(geometry.cellAtPointer(snapshot, {x: 350, y: 30}, {x: 0, y: 100}, 4)).toEqual({x: 4, y: 1});
    expect(geometry.cellAtPointer(snapshot, {x: 350, y: 30}, {x: 0, y: 145}, 4)).toEqual({x: 4, y: 2});
  });

  it('extrapolates rows below the captured grid', () => {
    const result = geometry.itemAtPointer(snapshot, {x: 20, y: 260}, {x: 0, y: 100}, 4, item, {x: 0, y: 0});
    expect(result.y).toBeGreaterThan(2);
  });

  it('resizes both axes from one frozen geometry snapshot', () => {
    const result = geometry.resizedItem(snapshot, {x: 335, y: 165}, {x: 0, y: 100}, 4, item, false, false, true, true);
    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
  });

  it('calculates a multi-row placeholder height from the captured tracks', () => {
    const rect = geometry.renderedRect(snapshot, {...item, height: 3}, {x: 0, y: 100});
    expect(rect.height).toBe(40 + 5 + 60 + 5 + 60);
  });

  it('preserves the captured grid height while adding extrapolated rows', () => {
    expect(geometry.minimumHeight(snapshot, 3)).toBe(40 + 5 + 60 + 5 + 60);
  });

  it('uses the final row height consistently for cells, moves, and resizing below the grid', () => {
    const pointer = {x: 20, y: 180};
    const scroll = snapshot.scroll;
    expect(geometry.cellAtPointer(snapshot, pointer, scroll, 4).y).toBe(3);
    expect(geometry.itemAtPointer(snapshot, pointer, scroll, 4, item, {x: 0, y: 0}).y).toBe(3);
    expect(geometry.resizedItem(snapshot, pointer, scroll, 4, item, false, false, true, false).height).toBe(3);
  });

  it('keeps the append edge tied to the original bottom and accounts for scrolling', () => {
    expect(geometry.isAtBottomEdge(snapshot, {x: 20, y: 80}, {x: 0, y: 100})).toBeFalse();
    expect(geometry.isAtBottomEdge(snapshot, {x: 20, y: 124}, {x: 0, y: 100})).toBeTrue();
    expect(geometry.isAtBottomEdge(snapshot, {x: 20, y: 1000}, {x: 0, y: 100})).toBeTrue();
    expect(geometry.isAtBottomEdge(snapshot, {x: 20, y: 74}, {x: 0, y: 150})).toBeTrue();
    expect(geometry.isAtBottomEdge(snapshot, {x: 20, y: 30}, {x: 0, y: 150})).toBeFalse();
  });
});

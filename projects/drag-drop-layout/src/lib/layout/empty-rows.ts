import {GridItem} from '../item/item.definitions';
import {LayoutSnapshot} from './layout.definitions';

export interface EmptyRowRemovedEvent<DATA = unknown> {
  readonly gridId: string;
  readonly row: number;
  readonly items: readonly GridItem<DATA>[];
  readonly rows: number;
}

export function findEmptyRows(snapshot: LayoutSnapshot): readonly number[] {
  const occupied = new Set<number>();
  for (const item of snapshot.items) {
    for (let row = item.y; row < item.y + item.height; row++) occupied.add(row);
  }
  return Array.from({length: snapshot.rows}, (_, index) => index + 1).filter(row => !occupied.has(row));
}

export function removeEmptyLayoutRow<DATA>(snapshot: LayoutSnapshot<DATA>, row: number): LayoutSnapshot<DATA> | null {
  if (!Number.isInteger(row) || row < 1 || row > snapshot.rows || snapshot.rows <= 1 ||
    snapshot.items.some(item => item.y <= row && item.y + item.height > row)) return null;
  return {
    ...snapshot,
    rows: snapshot.rows - 1,
    items: snapshot.items.map(item => item.y > row ? Object.freeze({...item, y: item.y - 1}) : item),
  };
}

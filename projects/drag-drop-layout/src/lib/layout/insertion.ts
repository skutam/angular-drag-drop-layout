import {GridItem} from '../item/item.definitions';
import {InsertionOptions, LayoutSnapshot, PlacementFailure} from './layout.definitions';

export const DEFAULT_INSERTION_OPTIONS: InsertionOptions = Object.freeze({sizing: 'fit-width', minWidth: 1});

type InsertionProposal<DATA> = {readonly ok: true; readonly item: GridItem<DATA>} | PlacementFailure<DATA>;

/** Choose a new item's initial width without modifying the destination layout. */
export function prepareInsertion<DATA>(
  snapshot: LayoutSnapshot<DATA>,
  preferred: GridItem<DATA>,
  column: number,
  row: number,
  options: InsertionOptions = DEFAULT_INSERTION_OPTIONS,
): InsertionProposal<DATA> {
  if (!['fit-width', 'fixed'].includes(options.sizing) ||
    !Number.isInteger(options.minWidth) || options.minWidth < 1 || options.minWidth > preferred.width) {
    return {ok: false, reason: 'invalid-config', attemptedItem: preferred};
  }
  if (![preferred.width, preferred.height].every((value) => Number.isInteger(value) && value >= 1)) {
    return {ok: false, reason: 'invalid-item', attemptedItem: preferred};
  }
  if (options.minWidth > snapshot.columns || (options.sizing === 'fixed' && preferred.width > snapshot.columns)) {
    return {ok: false, reason: 'out-of-bounds', attemptedItem: preferred};
  }

  const width = Math.min(preferred.width, snapshot.columns);
  const fallback = Object.freeze({...preferred, x: Math.min(column, snapshot.columns - width + 1), y: row, width});
  if (options.sizing === 'fixed') return {ok: true, item: fallback};

  let left = 1;
  let right = snapshot.columns;
  for (const item of snapshot.items) {
    if (item.y > row + preferred.height - 1 || item.y + item.height - 1 < row) continue;
    const itemRight = item.x + item.width - 1;
    if (item.x <= column && itemRight >= column) return {ok: true, item: fallback};
    if (itemRight < column) left = Math.max(left, itemRight + 1);
    else right = Math.min(right, item.x - 1);
  }

  const fittedWidth = Math.min(width, right - left + 1);
  if (fittedWidth < options.minWidth) return {ok: true, item: fallback};
  return {
    ok: true,
    item: Object.freeze({...preferred, x: Math.max(left, column - fittedWidth + 1), y: row, width: fittedWidth}),
  };
}

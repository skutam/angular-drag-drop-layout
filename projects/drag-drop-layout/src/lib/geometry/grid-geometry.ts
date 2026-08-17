import {GridItem} from '../item/item.definitions';
import {IPosition} from '../definitions';

export interface GridGeometrySnapshot {
  readonly viewportLeft: number;
  readonly viewportTop: number;
  readonly width: number;
  readonly columnWidth: number;
  readonly columnGap: number;
  readonly rowGap: number;
  readonly rowHeights: readonly number[];
  readonly fallbackRowHeight: number;
  readonly scroll: IPosition;
}

export interface RenderedRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export class GridGeometry {
  public capture(element: HTMLElement, columns: number, rows: number, scroll: IPosition): GridGeometrySnapshot {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const columnGap = numeric(style.columnGap);
    const rowGap = numeric(style.rowGap);
    const parsedRows = parsePixelTracks(style.gridTemplateRows);
    const availableHeight = Math.max(1, rect.height - rowGap * Math.max(0, rows - 1));
    const fallbackRowHeight = parsedRows.at(-1) ?? availableHeight / rows;
    const rowHeights = Array.from({length: rows}, (_, index) => parsedRows[index] ?? fallbackRowHeight);
    return {
      viewportLeft: rect.left,
      viewportTop: rect.top,
      width: rect.width,
      columnWidth: Math.max(1, (rect.width - columnGap * Math.max(0, columns - 1)) / columns),
      columnGap,
      rowGap,
      rowHeights,
      fallbackRowHeight,
      scroll,
    };
  }

  public itemAtPointer(
    geometry: GridGeometrySnapshot,
    pointer: IPosition,
    scroll: IPosition,
    columns: number,
    item: GridItem,
    itemOffset: IPosition,
  ): GridItem {
    const contentX = pointer.x - geometry.viewportLeft + scroll.x - geometry.scroll.x;
    const contentY = pointer.y - geometry.viewportTop + scroll.y - geometry.scroll.y;
    const pointedColumn = trackAt(contentX, [geometry.columnWidth], geometry.columnGap, true);
    const pointedRow = trackAt(contentY, geometry.rowHeights, geometry.rowGap, false, geometry.fallbackRowHeight);
    const x = clamp(1, columns - item.width + 1, pointedColumn + itemOffset.x);
    const y = Math.max(1, pointedRow + itemOffset.y);
    return Object.freeze({...item, x, y});
  }

  public resizedItem(
    geometry: GridGeometrySnapshot,
    pointer: IPosition,
    scroll: IPosition,
    columns: number,
    original: GridItem,
    top: boolean,
    left: boolean,
    bottom: boolean,
    right: boolean,
  ): GridItem {
    const contentX = pointer.x - geometry.viewportLeft + scroll.x - geometry.scroll.x;
    const contentY = pointer.y - geometry.viewportTop + scroll.y - geometry.scroll.y;
    const column = clamp(1, columns, trackAt(contentX, [geometry.columnWidth], geometry.columnGap, true));
    const row = Math.max(1, trackAt(contentY, geometry.rowHeights, geometry.rowGap, false, geometry.fallbackRowHeight));
    const originalRight = original.x + original.width - 1;
    const originalBottom = original.y + original.height - 1;
    const x = left ? Math.min(column, originalRight) : original.x;
    const y = top ? Math.min(row, originalBottom) : original.y;
    const width = left ? originalRight - x + 1 : right ? Math.max(1, column - original.x + 1) : original.width;
    const height = top ? originalBottom - y + 1 : bottom ? Math.max(1, row - original.y + 1) : original.height;
    return Object.freeze({...original, x, y, width, height});
  }

  public renderedRect(geometry: GridGeometrySnapshot, item: GridItem, scroll: IPosition): RenderedRect {
    const left = geometry.viewportLeft + sumTracks([geometry.columnWidth], geometry.columnGap, item.x - 1, true)
      - scroll.x + geometry.scroll.x + window.scrollX;
    const top = geometry.viewportTop + sumTracks(geometry.rowHeights, geometry.rowGap, item.y - 1, false, geometry.fallbackRowHeight)
      - scroll.y + geometry.scroll.y + window.scrollY;
    return {
      left,
      top,
      width: item.width * geometry.columnWidth + Math.max(0, item.width - 1) * geometry.columnGap,
      height: sumSpan(geometry.rowHeights, geometry.rowGap, item.y - 1, item.height, geometry.fallbackRowHeight),
    };
  }

  public minimumHeight(geometry: GridGeometrySnapshot, rows: number): number {
    return sumSpan(geometry.rowHeights, geometry.rowGap, 0, rows, geometry.fallbackRowHeight);
  }
}

function numeric(value: string): number {
  return Number.parseFloat(value) || 0;
}

function parsePixelTracks(value: string): number[] {
  return [...value.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1])).filter((track) => track > 0);
}

function trackAt(
  position: number,
  tracks: readonly number[],
  gap: number,
  repeatFirst: boolean,
  fallback = tracks[0] ?? 1,
): number {
  let offset = 0;
  let index = 0;
  while (index < 10000) {
    const size = repeatFirst ? (tracks[0] ?? fallback) : (tracks[index] ?? fallback);
    if (position <= offset + size + gap / 2) {
      return index + 1;
    }
    offset += size + gap;
    index++;
  }
  return index + 1;
}

function sumTracks(
  tracks: readonly number[],
  gap: number,
  count: number,
  repeatFirst: boolean,
  fallback = tracks[0] ?? 1,
): number {
  let total = 0;
  for (let index = 0; index < count; index++) {
    total += (repeatFirst ? (tracks[0] ?? fallback) : (tracks[index] ?? fallback)) + gap;
  }
  return total;
}

function sumSpan(tracks: readonly number[], gap: number, start: number, count: number, fallback: number): number {
  let total = Math.max(0, count - 1) * gap;
  for (let index = start; index < start + count; index++) {
    total += tracks[index] ?? fallback;
  }
  return total;
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

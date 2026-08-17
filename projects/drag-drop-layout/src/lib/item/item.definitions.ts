import {IPosition} from '../definitions';

export interface GridItem<DATA = unknown> {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly data?: DATA;
}

export type GridItemInput<DATA = unknown> = Omit<GridItem<DATA>, 'id'> & {readonly id?: string};

export function createGridItem<DATA = unknown>(item: GridItemInput<DATA>): GridItem<DATA> {
  return Object.freeze({
    ...item,
    id: item.id ?? crypto.randomUUID(),
  });
}

export function itemTrackBy(_: number, item: GridItem): string {
  return item.id;
}

export interface ItemDragEvent<DATA = unknown> {
  item: GridItem<DATA>;
  event: IPosition;
  scroll: IPosition;
}

export type ResizeType =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

export interface ResizeInfo {
  top: boolean;
  left: boolean;
  bottom: boolean;
  right: boolean;
  vertical: boolean;
  horizontal: boolean;
}

export function getResizeInfo(type: ResizeType): ResizeInfo {
  return {
    top: type.includes('top'),
    left: type.includes('left'),
    bottom: type.includes('bottom'),
    right: type.includes('right'),
    vertical: type.includes('top') || type.includes('bottom'),
    horizontal: type.includes('left') || type.includes('right'),
  };
}

export interface ItemResizeEvent<DATA = unknown> extends ItemDragEvent<DATA> {
  resizeType: ResizeType;
}

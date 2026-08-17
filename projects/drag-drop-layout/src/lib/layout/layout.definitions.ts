import {GridItem} from '../item/item.definitions';

export type MoveDirection = 'top' | 'left' | 'right' | 'bottom';
export type PlacementOperation = 'move' | 'resize' | 'insert' | 'transfer' | 'normalize';
export type PlacementRejectionReason =
  | 'invalid-config'
  | 'invalid-item'
  | 'duplicate-item-id'
  | 'out-of-bounds'
  | 'no-space'
  | 'not-connected'
  | 'outside-grid';

export interface LayoutSnapshot<DATA = unknown> {
  readonly items: readonly GridItem<DATA>[];
  readonly columns: number;
  readonly rows: number;
}

export interface PlacementRequest<DATA = unknown> extends LayoutSnapshot<DATA> {
  readonly active: GridItem<DATA>;
  readonly operation: PlacementOperation;
  readonly movePriority: readonly MoveDirection[];
  readonly allowRowGrowth: boolean;
  readonly mayRelocateActive?: boolean;
}

export interface PlacementSuccess<DATA = unknown> {
  readonly ok: true;
  readonly items: readonly GridItem<DATA>[];
  readonly rows: number;
}

export interface PlacementFailure<DATA = unknown> {
  readonly ok: false;
  readonly reason: PlacementRejectionReason;
  readonly attemptedItem: GridItem<DATA>;
}

export type PlacementResult<DATA = unknown> = PlacementSuccess<DATA> | PlacementFailure<DATA>;

export interface PlacementCommittedEvent<DATA = unknown> {
  readonly operation: PlacementOperation;
  readonly item: GridItem<DATA>;
  readonly sourceGridId: string | null;
  readonly targetGridId: string;
  readonly items: readonly GridItem<DATA>[];
  readonly rows: number;
}

export interface PlacementRejectedEvent<DATA = unknown> {
  readonly operation: PlacementOperation;
  readonly reason: PlacementRejectionReason;
  readonly item: GridItem<DATA>;
  readonly sourceGridId: string | null;
  readonly targetGridId: string | null;
}

export const DEFAULT_MOVE_PRIORITY: readonly MoveDirection[] = ['top', 'left', 'right', 'bottom'];

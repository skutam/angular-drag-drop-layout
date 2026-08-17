import {IPosition} from '../definitions';
import {GridGeometrySnapshot, RenderedRect} from '../geometry/grid-geometry';
import {GridItem} from '../item/item.definitions';
import {ResizeType} from '../item/item.definitions';
import {
  LayoutSnapshot,
  PlacementCommittedEvent,
  PlacementOperation,
  PlacementRejectedEvent,
  PlacementResult,
} from '../layout/layout.definitions';

export interface InteractionSession<DATA = unknown> {
  readonly pointerId: number;
  readonly operation: PlacementOperation;
  readonly sourceGridId: string | null;
  readonly item: GridItem<DATA>;
  readonly itemOffset: IPosition;
  readonly allowedTargets: ReadonlySet<string>;
  readonly sourceSnapshot: LayoutSnapshot<DATA> | null;
  resizeType?: ResizeType;
  readonly geometries: Map<string, GridGeometrySnapshot>;
  readonly snapshots: Map<string, LayoutSnapshot<DATA>>;
  targetGridId: string | null;
  lastResult: PlacementResult<DATA> | null;
}

export interface InteractionPreview<DATA = unknown> {
  readonly result: PlacementResult<DATA>;
  readonly rect?: RenderedRect;
}

export interface GridInteractionAdapter {
  readonly interactionGridId: string;
  readonly interactionConnectedTo: readonly string[];
  containsPointer(pointer: IPosition): boolean;
  snapshot(): LayoutSnapshot;
  captureGeometry(scroll: IPosition): GridGeometrySnapshot;
  preview(
    session: InteractionSession,
    snapshot: LayoutSnapshot,
    pointer: IPosition,
    scroll: IPosition,
  ): InteractionPreview;
  previewSourceRemoval(itemId: string, snapshot: LayoutSnapshot): void;
  clearPreview(snapshot?: LayoutSnapshot): void;
  commitPreview(): void;
  commitSourceRemoval(itemId: string): void;
  notifyPlacementCommitted(event: PlacementCommittedEvent): void;
  notifyPlacementRejected(event: PlacementRejectedEvent): void;
}

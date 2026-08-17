import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  DestroyRef,
  effect,
  ElementRef,
  Inject,
  input,
  model,
  OnDestroy,
  output,
  OutputRefSubscription,
  QueryList,
  signal,
  untracked,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HeightProp, HeightUnit, IPosition} from '../definitions';
import {GridGeometry, GridGeometrySnapshot} from '../geometry/grid-geometry';
import {GridInteractionAdapter, InteractionPreview, InteractionSession} from '../interaction/interaction.definitions';
import {GridItem, getResizeInfo} from '../item/item.definitions';
import {ItemComponent} from '../item/item.component';
import {LayoutEngine, validPriority} from '../layout/layout-engine';
import {prepareInsertion} from '../layout/insertion';
import {
  DEFAULT_MOVE_PRIORITY,
  LayoutSnapshot,
  MoveDirection,
  PlacementCommittedEvent,
  PlacementRejectedEvent,
  PlacementResult,
  PlacementSuccess,
} from '../layout/layout.definitions';
import {GridRegistry} from '../services/grid-registry.service';
import {GridService} from '../services/grid.service';
import {getScrollOffset} from '../util';

@Component({
  selector: 'ddl-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.css',
  host: {
    '[style.display]': '"grid"',
    '[style.gridTemplateRows]': 'gridTemplateRows',
    '[style.minHeight.px]': 'interactionMinHeight()',
  },
})
export class GridComponent implements AfterContentInit, OnDestroy, GridInteractionAdapter {
  @ContentChildren(ItemComponent, {descendants: true}) private itemComponents!: QueryList<ItemComponent>;

  public readonly gridId = input.required<string>();
  public readonly connectedTo = input<readonly string[]>([]);
  public readonly columns = model(12);
  public readonly rows = model(3);
  public readonly colGap = input<HeightUnit>('8px');
  public readonly rowGap = input<HeightUnit>('8px');
  public readonly items = model<readonly GridItem[]>([]);
  public readonly gridHeight = input<HeightProp>('auto');
  public readonly itemMinHeight = input<HeightUnit | null>(null);
  public readonly scrollableElement = input<HTMLElement | Document | null>(null);
  public readonly movePriority = input<readonly MoveDirection[]>(DEFAULT_MOVE_PRIORITY);
  public readonly allowRowGrowth = input(true);

  public readonly placementCommitted = output<PlacementCommittedEvent>();
  public readonly placementRejected = output<PlacementRejectedEvent>();

  public readonly renderedRows = signal(3);
  public readonly interactionMinHeight = signal<number | null>(null);

  private readonly engine = new LayoutEngine();
  private readonly geometry = new GridGeometry();
  private readonly subscriptions: OutputRefSubscription[] = [];
  private registeredId: string | null = null;
  private contentReady = false;
  private previewResult: PlacementSuccess | null = null;
  private placementCache: {
    session: InteractionSession;
    snapshot: LayoutSnapshot;
    key: string;
    result: PlacementResult;
  } | null = null;
  private lastValidItems: readonly GridItem[] = [];
  private lastValidRows = 3;
  private lastValidColumns = 12;
  private hasAcceptedLayout = false;
  private emittedInvalidInitialState = false;

  public constructor(
    @Inject(ElementRef) public readonly grid: ElementRef<HTMLElement>,
    private readonly registry: GridRegistry,
    private readonly gridService: GridService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.bindCssProperty('--ddl-grid-columns', this.columns);
    this.bindCssProperty('--ddl-grid-rows', this.renderedRows);
    this.bindCssProperty('--ddl-grid-col-gap', this.colGap);
    this.bindCssProperty('--ddl-grid-row-gap', this.rowGap);
    this.bindCssProperty('--ddl-grid-prop-height', this.gridHeight);
    this.bindCssProperty('--ddl-grid-item-min-height', this.itemMinHeight);

    effect(() => {
      const id = this.gridId();
      if (this.registeredId === id) return;
      const previousId = this.registeredId;
      if (previousId) {
        untracked(() => this.gridService.cancelForGrid(previousId));
        this.registry.unregister(previousId);
      }
      this.registry.register(this);
      this.registeredId = id;
    }, {allowSignalWrites: true});

    effect(() => {
      const items = this.items();
      const rows = this.rows();
      const columns = this.columns();
      const priority = this.movePriority();
      const allowRowGrowth = this.allowRowGrowth();
      untracked(() => this.acceptExternalLayout(items, rows, columns, priority, allowRowGrowth));
    }, {allowSignalWrites: true});
  }

  public get interactionGridId(): string {
    return this.gridId();
  }

  public get interactionConnectedTo(): readonly string[] {
    return this.connectedTo();
  }

  public get gridTemplateRows(): string {
    return this.itemMinHeight() === null
      ? `repeat(${this.renderedRows()}, 1fr)`
      : `repeat(${this.renderedRows()}, minmax(var(--ddl-grid-item-min-height), auto))`;
  }

  public ngAfterContentInit(): void {
    this.contentReady = true;
    this.itemComponents.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.connectItemComponents();
      this.render(this.previewResult?.items ?? this.lastValidItems);
    });
    this.connectItemComponents();
    this.render(this.lastValidItems);
  }

  public ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    if (this.registeredId) {
      this.gridService.cancelForGrid(this.registeredId);
      this.registry.unregister(this.registeredId);
    }
  }

  public containsPointer(pointer: IPosition): boolean {
    const rect = this.grid.nativeElement.getBoundingClientRect();
    return pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
  }

  public snapshot(): LayoutSnapshot {
    return {
      items: this.lastValidItems.map((item) => Object.freeze({...item})),
      columns: this.lastValidColumns,
      rows: this.lastValidRows,
    };
  }

  public captureGeometry(scroll: IPosition): GridGeometrySnapshot {
    return this.geometry.capture(this.grid.nativeElement, this.lastValidColumns, this.lastValidRows, scroll);
  }

  public preview(
    session: InteractionSession,
    snapshot: LayoutSnapshot,
    pointer: IPosition,
    scroll: IPosition,
  ): InteractionPreview {
    const geometry = session.geometries.get(this.interactionGridId)!;
    const resizeInfo = session.resizeType ? getResizeInfo(session.resizeType) : null;
    // Offer one append position at the original bottom edge. Preview growth
    // must not move that position or create further drop rows in this drag.
    const append = !resizeInfo && this.allowRowGrowth() && this.movePriority().includes('bottom') &&
      this.geometry.isAtBottomEdge(geometry, pointer, scroll);
    let proposed: GridItem;
    if (session.operation === 'insert') {
      const cell = this.geometry.cellAtPointer(geometry, pointer, scroll, snapshot.columns);
      const row = append ? snapshot.rows + 1 : Math.min(cell.y, snapshot.rows);
      const insertion = prepareInsertion(snapshot, session.item, cell.x, row, session.insertion);
      if (!insertion.ok) {
        this.clearPreview(snapshot);
        return {result: insertion};
      }
      proposed = insertion.item;
    } else {
      proposed = resizeInfo
        ? this.geometry.resizedItem(
          geometry,
          pointer,
          scroll,
          snapshot.columns,
          session.item,
          resizeInfo.top,
          resizeInfo.left,
          resizeInfo.bottom,
          resizeInfo.right,
        )
        : this.geometry.itemAtPointer(geometry, pointer, scroll, snapshot.columns, session.item, session.itemOffset);
      if (!resizeInfo) {
        proposed = {...proposed, y: append ? snapshot.rows + 1 : Math.min(proposed.y, snapshot.rows)};
      }
    }
    const operation = session.sourceGridId && session.sourceGridId !== this.interactionGridId
      ? 'transfer'
      : session.operation;
    if (session.sourceGridId !== this.interactionGridId && snapshot.items.some((item) => item.id === proposed.id)) {
      this.clearPreview(snapshot);
      return {result: {ok: false, reason: 'duplicate-item-id', attemptedItem: proposed}};
    }
    const request = {
      ...snapshot,
      active: proposed,
      operation,
      movePriority: this.movePriority(),
      allowRowGrowth: this.allowRowGrowth(),
    };
    const key = JSON.stringify([proposed.id, proposed.x, proposed.y, proposed.width, proposed.height,
      operation, request.movePriority, request.allowRowGrowth]);
    const cached = this.placementCache;
    const result = cached?.session === session && cached.snapshot === snapshot && cached.key === key
      ? cached.result : this.engine.resolvePlacement(request);

    if (!result.ok) {
      this.clearPreview(snapshot);
      this.placementCache = {session, snapshot, key, result};
      return {result};
    }
    this.placementCache = {session, snapshot, key, result};

    const latchedRows = Math.max(this.previewResult ? this.renderedRows() : snapshot.rows, result.rows);
    this.previewResult = result;
    this.applyRenderedRows(latchedRows);
    if (resizeInfo?.vertical) {
      this.applyInteractionMinHeight(this.geometry.minimumHeight(geometry, latchedRows));
    } else {
      this.applyInteractionMinHeight(null);
    }
    this.render(result.items);
    const active = result.items.find((item) => item.id === session.item.id)!;
    const renderedComponent = this.itemComponents?.find((component) => component.itemId() === active.id);
    const renderedRect = renderedComponent?.element.getBoundingClientRect();
    return {
      result: this.previewResult,
      rect: renderedRect && renderedRect.width > 0 && renderedRect.height > 0
        ? {
          left: renderedRect.left + window.scrollX,
          top: renderedRect.top + window.scrollY,
          width: renderedRect.width,
          height: renderedRect.height,
        }
        : this.geometry.renderedRect(geometry, active, scroll),
    };
  }

  public previewSourceRemoval(itemId: string, snapshot: LayoutSnapshot): void {
    this.placementCache = null;
    const items = snapshot.items.filter((item) => item.id !== itemId);
    this.previewResult = {ok: true, items, rows: snapshot.rows};
    this.applyRenderedRows(snapshot.rows);
    this.applyInteractionMinHeight(null);
    this.render(items, itemId);
  }

  public clearPreview(snapshot: LayoutSnapshot = this.snapshot()): void {
    this.placementCache = null;
    this.previewResult = null;
    this.applyRenderedRows(snapshot.rows);
    this.applyInteractionMinHeight(null);
    this.render(snapshot.items);
  }

  public commitPreview(): void {
    this.placementCache = null;
    if (!this.previewResult) return;
    const result = this.previewResult;
    this.lastValidItems = result.items;
    this.lastValidRows = result.rows;
    this.items.set(result.items);
    this.rows.set(result.rows);
    this.previewResult = null;
    this.applyRenderedRows(result.rows);
    this.applyInteractionMinHeight(null);
    this.render(result.items);
  }

  public commitSourceRemoval(itemId: string): void {
    this.placementCache = null;
    const items = this.lastValidItems.filter((item) => item.id !== itemId);
    this.lastValidItems = items;
    this.items.set(items);
    this.previewResult = null;
    this.applyRenderedRows(this.lastValidRows);
    this.applyInteractionMinHeight(null);
    this.render(items);
  }

  public notifyPlacementCommitted(event: PlacementCommittedEvent): void {
    this.placementCommitted.emit(event);
  }

  public notifyPlacementRejected(event: PlacementRejectedEvent): void {
    this.placementRejected.emit(event);
  }

  private acceptExternalLayout(
    items: readonly GridItem[],
    rows: number,
    columns: number,
    priority: readonly MoveDirection[],
    allowRowGrowth: boolean,
  ): void {
    if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
      throw new Error('Grid columns and rows must be positive integers.');
    }
    if (!validPriority(priority)) {
      throw new Error('movePriority must be a non-empty, duplicate-free list of top, left, right, or bottom.');
    }
    if (this.hasAcceptedLayout && sameLayout(items, this.lastValidItems) &&
      rows === this.lastValidRows && columns === this.lastValidColumns) {
      return;
    }
    if (this.hasAcceptedLayout) {
      this.gridService.cancelForGrid(this.interactionGridId);
    }
    const permitGrowth = this.hasAcceptedLayout && rows < this.lastValidRows ? false : allowRowGrowth;
    const normalized = this.engine.normalize({items, columns, rows}, priority, permitGrowth);
    if (!normalized.ok) {
      const fallbackItems = this.lastValidItems;
      if (!this.hasAcceptedLayout) {
        this.lastValidRows = rows;
        this.lastValidColumns = columns;
        this.hasAcceptedLayout = true;
      }
      this.columns.set(this.lastValidColumns);
      this.rows.set(this.lastValidRows);
      this.items.set(fallbackItems);
      this.grid.nativeElement.style.setProperty('--ddl-grid-columns', this.lastValidColumns.toString());
      this.clearPreview(this.snapshot());
      if (this.contentReady || !this.emittedInvalidInitialState) {
        this.emittedInvalidInitialState = true;
        this.placementRejected.emit({
          operation: 'normalize',
          reason: normalized.reason,
          item: normalized.attemptedItem,
          sourceGridId: this.registeredId,
          targetGridId: this.registeredId,
        });
      }
      return;
    }

    this.lastValidItems = normalized.items;
    this.lastValidRows = normalized.rows;
    this.lastValidColumns = columns;
    this.hasAcceptedLayout = true;
    this.applyRenderedRows(normalized.rows);
    if (!sameLayout(items, normalized.items) || rows !== normalized.rows) {
      this.rows.set(normalized.rows);
      this.items.set(normalized.items);
    }
    if (this.contentReady) this.render(normalized.items);
  }

  private connectItemComponents(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions.length = 0;
    const componentIds = new Set<string>();
    this.itemComponents.forEach((component) => {
      const id = component.itemId();
      if (componentIds.has(id)) throw new Error(`Duplicate ddl-item itemId: ${id}`);
      componentIds.add(id);
      component.scrollableElement.set(this.scrollableElement());
      this.subscriptions.push(
        component.dragStart.subscribe(({event}) => {
          const pointer = event as PointerEvent;
          const scroll = getScrollOffset(this.scrollableElement());
          const geometry = this.captureGeometry(scroll);
          const pointed = this.geometry.cellAtPointer(
            geometry,
            pointer,
            scroll,
            this.lastValidColumns,
          );
          this.gridService.startGridDrag(
            this,
            component.getItem(),
            component.element,
            pointer,
            {x: component.x() - pointed.x, y: component.y() - pointed.y},
            this.scrollableElement(),
          );
        }),
        component.resizeStart.subscribe(({event, resizeType}) => this.gridService.startResize(
          this,
          component.getItem(),
          component.element,
          event as PointerEvent,
          resizeType,
          this.scrollableElement(),
        )),
      );
    });
  }

  private render(items: readonly GridItem[], hiddenItemId?: string): void {
    if (!this.contentReady) return;
    const byId = new Map(items.map((item) => [item.id, item]));
    this.itemComponents.forEach((component) => {
      const item = byId.get(component.itemId()) ?? this.lastValidItems.find((candidate) => candidate.id === component.itemId());
      if (item) {
        component.render(item, component.itemId() === hiddenItemId);
      } else {
        component.setPreviewHidden(true);
      }
    });
  }

  private bindCssProperty(property: string, value: {(): unknown}): void {
    effect(() => {
      const next = value();
      if (next === null || next === undefined) {
        this.grid.nativeElement.style.removeProperty(property);
      } else {
        this.grid.nativeElement.style.setProperty(property, next.toString());
      }
    });
  }

  private applyRenderedRows(rows: number): void {
    this.renderedRows.set(rows);
    this.grid.nativeElement.style.setProperty('--ddl-grid-rows', rows.toString());
    this.grid.nativeElement.style.gridTemplateRows = this.itemMinHeight() === null
      ? `repeat(${rows}, 1fr)`
      : `repeat(${rows}, minmax(var(--ddl-grid-item-min-height), auto))`;
  }

  private applyInteractionMinHeight(height: number | null): void {
    this.interactionMinHeight.set(height);
    this.grid.nativeElement.style.minHeight = height === null ? '' : `${height}px`;
  }
}

function sameLayout(a: readonly GridItem[], b: readonly GridItem[]): boolean {
  return a.length === b.length && a.every((item, index) => {
    const other = b[index];
    return !!other && item.id === other.id && item.x === other.x && item.y === other.y &&
      item.width === other.width && item.height === other.height && item.data === other.data;
  });
}

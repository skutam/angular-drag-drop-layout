import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  DestroyRef,
  effect,
  ElementRef,
  Inject,
  input,
  InputSignal,
  model,
  OnDestroy,
  output,
  OutputRefSubscription,
  QueryList,
} from '@angular/core';
import {ItemComponent} from "../item/item.component";
import {getResizeInfo, Item, ResizeInfo, ResizeType} from "../item/item.definitions";
import {GridDragItemService} from "../services/grid-drag-item.service";
import {GridEvent, GridItemDroppedEvent, GridRectData, IGridPointerEvent} from "./grid.definitions";
import {GridService} from "../services/grid.service";
import {outputToObservable, takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {filter, take, takeUntil} from "rxjs";
import {clamp} from "../util";
import {HeightProp, HeightUnit, IPosition} from "../definitions";

@Component({
  selector: 'ddl-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.css',
  host: {
    '[style.display]': '"grid"',
    '[style.gridTemplateRows]': 'gridTemplateRows',
  }
})
export class GridComponent implements AfterViewInit, OnDestroy {
  public id: string = `${crypto.randomUUID()}`;

  @ContentChildren(ItemComponent, {descendants: true}) private itemComponents!: QueryList<ItemComponent>;

  get gridTemplateRows(): string {
    return this.itemMinHeight() === null
      ? `repeat(var(--ddl-grid-rows), 1fr)`
      : `repeat(var(--ddl-grid-rows), minmax(var(--ddl-grid-item-min-height), auto))`;
  }

  // Inputs
  public columns = input<number>(12);
  public rows = input<number>(3);
  public colGap= input<HeightUnit>('8px');
  public rowGap = input<HeightUnit>('8px');
  public items = model<Item[]>([] as Item[])

  public gridHeight = input<HeightProp>('auto');
  public itemMinHeight = input<HeightUnit|null>(null);
  public scrollableElement = input<HTMLElement | Document | null>(null);

  // Outputs
  public dragEnter = output<GridEvent>();
  public dragLeave = output<GridEvent>();
  public itemDropped = output<GridItemDroppedEvent>();

  private itemComponentSubscriptions: OutputRefSubscription[] = [];

  /**
   * Determines if the user is dragging an item inside this grid
   */
  private _dragging = false;

  constructor(
    @Inject(ElementRef) public grid: ElementRef<HTMLElement>,
    private gridDragItemService: GridDragItemService,
    private gridService: GridService,
    private destroyRef: DestroyRef,
    private cdRef: ChangeDetectorRef,
  ) {
    this.registerPropertyEffect('--ddl-grid-columns', this.columns);
    this.registerPropertyEffect('--ddl-grid-rows', this.rows);
    this.registerPropertyEffect('--ddl-grid-col-gap', this.colGap);
    this.registerPropertyEffect('--ddl-grid-row-gap', this.rowGap);
    this.registerPropertyEffect('--ddl-grid-prop-height', this.gridHeight);
    this.registerPropertyEffect('--ddl-grid-item-min-height', this.itemMinHeight);

    effect(() => {
      this.items();
      this.cdRef.detectChanges();
    });

    this.gridDragItemService.registerGrid(this);

    outputToObservable(this.dragEnter).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((gridEvent) => {
      this._dragging = true;
      const item = gridEvent.item;
      const {cellWidth, cellHeight, colGap, rowGap} = this.calcGridRectData();
      const width = item.width * cellWidth + (item.width - 1) * colGap;
      const height = item.height * cellHeight + (item.height - 1) * rowGap;
      this.gridService.resizePlaceholder(width, height);
      const {x, y} = this.calculateItemPosition(gridEvent, item.width, item.height);

      const newItem = new Item(item.id, x, y, item.width, item.height, item.data);

      // Update items when we are dragging new item into the grid
      this.items.update(items => items.find(i => i.id === item.id) ? items : [...items, newItem]);
    });

    outputToObservable(this.dragLeave).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({dragResizeData, item}) => {
      this._dragging = false;
      if (dragResizeData.dragItemElement) {
        const {width, height} = dragResizeData.dragItemElement.getBoundingClientRect();
        this.gridService.resizePlaceholder(width, height);
      }

      // Update items by removing the currently dragged item from them
      this.items.update(items => items.filter(i => i.id !== item.id));
    });

    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(() => this._dragging),
    ).subscribe((gridPointerEvent) => this.dragMove(gridPointerEvent));

    this.gridService.pointerEnd$.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(() => this._dragging),
    ).subscribe((gridPointerEvent) => {
      const dragItem = this.items().find((i) => i.id === 'dragItem');

      // Dragging new ddl-item into the grid
      if (dragItem) {
        const oldItems = this.items().filter((i) => i.id !== 'dragItem');
        const {x, y} = this.calculateItemPosition(gridPointerEvent, dragItem.width, dragItem.height);
        const item = new Item(null, x, y, dragItem.width, dragItem.height, dragItem.data);
        this.items.set([...oldItems, item]);
        this.itemDropped.emit({
          event: gridPointerEvent.event,
          item,
        });
      } else {
        // Emit itemDropped event when dragging from one grid to another
        if (gridPointerEvent.dragResizeData.fromGrid !== gridPointerEvent.dragResizeData.currentGrid && gridPointerEvent.dragResizeData.currentGrid === this) {
          this.itemDropped.emit({
            event: gridPointerEvent.event,
            item: gridPointerEvent.dragResizeData.item,
          });
        }
        this.items.set(this.itemComponents.map(c => c.getItem()));
      }
      this._dragging = false;
    });
  }

  public ngAfterViewInit(): void {
    this.itemComponents.changes.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.updateItemComponents());
    this.updateItemComponents();
  }

  public ngOnDestroy(): void {
    this.itemComponentSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.itemComponentSubscriptions = [];
    this.gridDragItemService.unregisterGrid(this);
  }

  private registerPropertyEffect(property: string, signalValue: InputSignal<any>): void {
    effect(() => {
      this.grid.nativeElement.style.setProperty(property, signalValue()?.toString());
    });
  }

  /**
   * Updates the item components when the items change
   */
  private updateItemComponents(): void {
    this.validateItems();

    this.itemComponentSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.itemComponentSubscriptions = [];

    this.itemComponents.forEach((item, index) => {
      const itemData = this.items()[index];
      item.id = itemData.id;
      item.x.set(itemData.x);
      item.y.set(itemData.y);
      item.width.set(itemData.width);
      item.height.set(itemData.height);
      item.data.set(itemData.data);
      item.scrollableElement.set(this.scrollableElement());

      this.itemComponentSubscriptions.push(
        // Register drag events
        item.dragStart.subscribe(({event}) => {
          const itemPosInGrid = this.calcItemPositionInGrid(event);
          this.gridService.startDrag(this, item.getItem(), item, event,{
            x: item.x() - itemPosInGrid.x,
            y: item.y() - itemPosInGrid.y,
          }, this.scrollableElement());
        }),
        // Register resize events
        item.resizeStart.subscribe(({resizeType, event}) => this.resizeStart(item, event, resizeType)),
      );
    });
  }

  /**
   * Moves the item while dragging
   */
  private dragMove(gridPointerEvent: IGridPointerEvent): void {
    const item = this.itemComponents.find((item) => item.id === gridPointerEvent.dragResizeData.item.id);
    if (!item) {
      return;
    }

    const {x, y} = this.calculateItemPosition(gridPointerEvent, item.width(), item.height());
    item.x.set(x);
    item.y.set(y);
  }

  private resizeStart(item: ItemComponent, mousePos: IPosition, resizeType: ResizeType): void {
    this.gridService.startResize(item.getItem(), item, mousePos, this.scrollableElement());

    const initResizeItem = item.getItem();
    const resizeInfo = getResizeInfo(resizeType);

    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
    ).subscribe(({event, scroll}) => {
      const gridRect = this.calcGridRectData();
      this.resizeMove(event, item, resizeInfo, initResizeItem, gridRect);

      // Move placeholder after rendering the item in the grid
      setTimeout(() => {
        const initItemRect = item.element.getBoundingClientRect();
        let {newWidth, newHeight, newDeltaX, newDeltaY} = this.resizeCalculate(event, scroll, resizeInfo, item, initItemRect, gridRect);
        this.gridService.resizePlaceholder(newWidth, newHeight);
        this.gridService.movePlaceholder(newDeltaX, newDeltaY);
      }, 0);
    });

    this.gridService.pointerEnd$.pipe(
      takeUntilDestroyed(this.destroyRef),
      take(1),
    ).subscribe(() => this.items.set(this.itemComponents.map((item) => item.getItem())));
  }

  // TODO: When resizing outside the window, the scroll position is not taken into account
  /**
   * Moves the item while resizing
   * @param mousePos The position of the mouse pointer on the screen
   * @param item The item component being resized
   * @param resizeInfo The resize info, which sides are being resized
   * @param initResizeItem The initial item being resized
   * @param gridRect The bounding rect of the grid
   * @private
   */
  private resizeMove(mousePos: IPosition, item: ItemComponent, resizeInfo: ResizeInfo, initResizeItem: Item, gridRect: GridRectData): void {
    const xOnGrid = clamp(1, gridRect.width, mousePos.x - gridRect.left);
    const x = this.calcGridItemPosition(xOnGrid, gridRect.cellWidth, gridRect.colGap, this.columns());
    if (resizeInfo.left) {
      const rightX = item.x() + item.width() - 1;
      const widthCols = rightX - x + 1;
      item.width.set(Math.max(1, widthCols));
      item.x.set(Math.max(1, (initResizeItem.x + initResizeItem.width) - item.width()));
    } else if (resizeInfo.horizontal) {
      const widthCols = x - item.x() + 1;
      item.width.set(Math.max(1, Math.min(widthCols, this.columns() - item.x() + 1)));
    }

    const yOnGrid = clamp(1, gridRect.height, mousePos.y - gridRect.top);
    const y = this.calcGridItemPositionY(yOnGrid, gridRect.rowGap);
    if (resizeInfo.top) {
      const bottomY = item.y() + item.height() - 1;
      const heightCells = bottomY - y + 1;
      item.height.set(Math.max(1, heightCells));
      item.y.set(Math.max(1, (initResizeItem.y + initResizeItem.height) - item.height()));
    } else if (resizeInfo.vertical) {
      const heightCells = y - item.y() + 1;
      item.height.set(Math.max(1, Math.min(heightCells, this.rows() - item.y() + 1)));
    }
  }

  /**
   * Calculates the new width and height of the placeholder item
   * @param mousePos The position of the mouse pointer on the screen
   * @param scroll The scroll offset of the scrollable element
   * @param resizeInfo The resize info, which sides are being resized
   * @param item The item component being resized
   * @param initItemRect The initial bounding rect of the item being resized
   * @param gridRect The bounding rect of the grid
   */
  private resizeCalculate(mousePos: IPosition, scroll: IPosition, resizeInfo: ResizeInfo, item: ItemComponent, initItemRect: DOMRect, gridRect: GridRectData): {newWidth: number, newHeight: number, newDeltaX: number, newDeltaY: number} {
    let newWidth = this.gridService.getItem().width;
    let newHeight = this.gridService.getItem().height;
    let newDeltaX = this.gridService.getItem().x;
    let newDeltaY = this.gridService.getItem().y;

    // Calculate width and move item on an x-axis
    if (resizeInfo.horizontal) {
      // Resize width and move item on x-axis
      if (resizeInfo.left) {
        newDeltaX = Math.min(mousePos.x + scroll.x, initItemRect.right + scroll.x);
        newWidth = initItemRect.right - mousePos.x;
      } else {
        newWidth = mousePos.x - initItemRect.left;
      }
      newHeight = initItemRect.height; // Set the height to the initial height, because we have dynamic row heights
    }

    // Calculate height and move item on y-axis
    if (resizeInfo.vertical) {
      // Resize height and move item on y-axis
      if (resizeInfo.top) {
        newDeltaY = Math.min(mousePos.y + scroll.y, initItemRect.bottom + scroll.y);
        newHeight = initItemRect.bottom - mousePos.y;
      } else {
        // Calculate the newDeltaY because we have dynamic row heights, and they can change
        const rowHeights: number[] = this.getRowHeights();
        const heightOffset = rowHeights.slice(0, item.y() - 1).reduce((acc, height) => acc + height, 0);
        const gapOffset = (item.y() - 1) * gridRect.rowGap;
        newDeltaY = gridRect.top + heightOffset + gapOffset + scroll.y;

        newHeight = mousePos.y - initItemRect.top;
      }
    }

    // Force width and height to be at least 1 pixel
    newWidth = Math.max(1, newWidth);
    newHeight = Math.max(1, newHeight);

    return {newWidth, newHeight, newDeltaX, newDeltaY};
  }

  public eventInsideGrid(event: PointerEvent): boolean {
    const gridRect = this.grid.nativeElement.getBoundingClientRect();
    return gridRect!.left <= event.clientX && event.clientX <= gridRect!.right &&
      gridRect!.top <= event.clientY && event.clientY <= gridRect!.bottom;
  }

  private validateItems(): void {
    // Check for duplicate item ids
    const ids = new Set<string>();
    this.itemComponents.forEach((item) => {
      if (ids.has(item.id)) {
        throw new Error(`Duplicate item id found: ${item.id}`);
      }
      ids.add(item.id);
    });

    // Check if the item count matches the item components
    if (this.items().length !== this.itemComponents.length) {
      throw new Error('Item count mismatch');
    }
  }

  /**
    * Calculates the cell width and height, and the delta x and y of the mouse relative to the grid
   */
  private calcGridRectData(): GridRectData {
    const gridElement = this.grid.nativeElement;
    const gridRect = gridElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(gridElement);

    const colGap = parseInt(computedStyle.columnGap, 10) || 0;
    const rowGap = parseInt(computedStyle.rowGap, 10) || 0;

    const gridWidth = gridRect.width;
    const gridHeight = gridRect.height;

    const cellWidth = (gridWidth - colGap * (this.columns() - 1)) / this.columns();
    const cellHeight = (gridHeight - rowGap * (this.rows() - 1)) / this.rows();

    return {
      top: gridRect.top,
      left: gridRect.left,
      width: gridWidth,
      height: gridHeight,
      cellWidth,
      cellHeight,
      colGap,
      rowGap,
    }
  }

  /**
   * Calculates the new x and y position of the item being dragged, making sure it doesn't go out of bounds
   * @param gridPointerEvent The grid pointer event
   * @param width The width of the item being dragged
   * @param height The height of the item being dragged
   * @private
   */
  private calculateItemPosition(gridPointerEvent: IGridPointerEvent, width: number, height: number): {x: number, y: number} {
    const {x, y} = this.calcItemPositionInGrid(gridPointerEvent.event);

    const newX = clamp(1, this.columns() - (width - Math.abs(gridPointerEvent.dragResizeData.itemOffset.x)) + 1, x + gridPointerEvent.dragResizeData.itemOffset.x);
    const newY = clamp(1, this.rows() - (height - Math.abs(gridPointerEvent.dragResizeData.itemOffset.y)) + 1, y + gridPointerEvent.dragResizeData.itemOffset.y);
    return {x: newX, y: newY};
  }

  /**
   * Calculates the x and y position of the pointer relative to the grid, 0,0 is the top left corner of the grid
   * @param mousePos
   * @private
   */
  private calcItemPositionInGrid(mousePos: IPosition): IPosition {
    const gridRectData = this.calcGridRectData();

    // Calculate the x and y position of the pointer relative to the grid, 0,0 is the top left corner of the grid
    const xOnGrid = clamp(1, gridRectData.width, mousePos.x - gridRectData.left);
    const yOnGrid = clamp(1, gridRectData.height, mousePos.y - gridRectData.top);

    const x = this.calcGridItemPosition(xOnGrid, gridRectData.cellWidth, gridRectData.colGap, this.columns());
    const y = this.calcGridItemPositionY(yOnGrid, gridRectData.rowGap);

    return {x, y};
  }

  /**
   * Calculates the grid item position based on the pointer position
   * @param position The position of the pointer
   * @param cellSize The size of the cell
   * @param gap The gap between the cells
   * @param max The maximum number of cells
   * @private
   */
  private calcGridItemPosition(position: number, cellSize: number, gap: number, max: number): number {
    if (position <= cellSize + gap / 2) return 1;                                     // First square
    if (position >= (cellSize + gap) * (max - 1) - gap / 2) return max;               // Last square
    return Math.floor((position - (cellSize + gap / 2)) / (cellSize + gap)) + 2;   // Middle square
  }

  /**
   * Calculates the grid item position based on the pointer position
   * @param position The position of the pointer
   * @param gap The gap between the cells
   * @private
   */
  private calcGridItemPositionY(position: number, gap: number): number {
    const heights = this.getRowHeights();

    let from = 0;
    let to = 0;

    for (let i = 0; i < heights.length; i++) {
      const height = heights[i];
      to += height + gap;
      if (position >= from && position <= to) {
        return i + 1;
      }
    }

    return heights.length;
  }

  private getRowHeights(): number[] {
    const pixelHeights = window.getComputedStyle(this.grid.nativeElement).gridTemplateRows;
    return pixelHeights.split(' ').map((height) => parseInt(height, 10));
  }

  /**
   * TODO: Figure out how to calculate move of items when dragging/resizing, so the items move out of the way
   */
}

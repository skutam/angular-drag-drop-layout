import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component, ContentChildren, DestroyRef,
  effect,
  ElementRef,
  Inject,
  input,
  InputSignal, model, OnDestroy, output, OutputRefSubscription, QueryList,
} from '@angular/core';
import {NgForOf} from "@angular/common";
import {ItemComponent} from "../item/item.component";
import {getResizeInfo, Item, ResizeType} from "../item/item.definitions";
import {GridDragItemService} from "../services/grid-drag-item.service";
import {DragItemDirective} from "../directives/drag-item.directive";
import {GridEvent, GridRectData, IDragResizeData} from "./grid.definitions";
import {GridService} from "../services/grid.service";
import {outputToObservable, takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {filter, take, takeUntil} from "rxjs";
import {clamp} from "../util";


@Component({
  selector: 'ddl-grid',
  standalone: true,
  imports: [ItemComponent, NgForOf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.css',
})
export class GridComponent implements AfterViewInit, OnDestroy {
  private static itemIdCounter: number = 0;
  public id: string = `${GridComponent.itemIdCounter++}`;

  @ContentChildren(ItemComponent, {descendants: true}) private itemComponents!: QueryList<ItemComponent>;

  // Inputs
  public columns = input(12);
  public rows = input(3);
  public colGap= input(8);
  public rowGap = input(8);
  public items = model([] as Item[]);

  // Outputs
  public dragEnter = output<GridEvent>();
  public dragLeave = output<GridEvent>();
  public itemDropped = output<GridEvent>();

  private itemComponentSubscriptions: OutputRefSubscription[] = [];
  private dragItemComponentSubscriptions: OutputRefSubscription[] = [];

  /**
   * Determines if the user is dragging an item inside this grid
   */
  private _dragging = false;

  constructor(
    @Inject(ElementRef) public grid: ElementRef<HTMLElement>,
    private gridDragItemService: GridDragItemService,
    private gridService: GridService,
    private destroyRef: DestroyRef,
  ) {
    this.registerPropertyEffect('--ddl-grid-columns', this.columns);
    this.registerPropertyEffect('--ddl-grid-rows', this.rows);
    this.registerPropertyEffect('--ddl-grid-col-gap', this.colGap, 'px');
    this.registerPropertyEffect('--ddl-grid-row-gap', this.rowGap, 'px');

    this.gridDragItemService.registerGrid(this);

    outputToObservable(this.dragEnter).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this._dragging = true;
      console.log('Dragging entered grid', this.id);
    });

    outputToObservable(this.dragLeave).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this._dragging = false;
      console.log('Dragging left grid', this.id);
    });
  }

  public ngAfterViewInit(): void {
    this.itemComponents.changes.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.updateItemComponents());
    this.updateItemComponents();

    this.gridDragItemService.getGridItems(this).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((items) => {
      this.updateItemDirectiveComponents(items);
    });
  }

  public ngOnDestroy(): void {
    this.itemComponentSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.itemComponentSubscriptions = [];
    this.dragItemComponentSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.dragItemComponentSubscriptions = [];
    this.gridDragItemService.unregisterGrid(this);
  }

  private registerPropertyEffect(property: string, signalValue: InputSignal<any>, append: string = ''): void {
    effect(() => {
      this.grid.nativeElement.style.setProperty(property, signalValue().toString() + append);
    });
  }

  private updateItemDirectiveComponents(items: DragItemDirective[]): void {
    this.dragItemComponentSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.dragItemComponentSubscriptions = [];

    items.forEach((item) => {
      this.dragItemComponentSubscriptions.push(
        item.dragStart.subscribe((event) => this.dragStartItem(event, item)),
        item.dragMove.subscribe((event) => this.dragMoveItem(event, item)),
        item.dragEnd.subscribe((event) => this.dragEndItem(event, item)),
      );
    });
  }

  private dragStartItem(event: PointerEvent, item: DragItemDirective): void {
    console.log('drag start item', event, item);
    // this.gridService.startDrag(null, item.getItem(), null, event);
  }

  private dragMoveItem(event: PointerEvent, item: DragItemDirective): void {
  }

  private dragEndItem(event: PointerEvent, item: DragItemDirective): void {
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

      this.itemComponentSubscriptions.push(
        // Register drag events
        item.dragStart.subscribe(({event}) => this.dragStart(this, event, item)),
        // Register resize events
        item.resizeStart.subscribe(({resizeType, event}) => this.resizeStart(item, event, resizeType)),
      );
    });
  }

  /**
   * Starts dragging an item
   */
  // TODO: When dragging outside the window, the scroll position is not taken into account
  private dragStart(fromGrid: GridComponent, event: PointerEvent, item: ItemComponent): void {
    const itemPosInGrid = this.calcItemPositionInGrid(event);

    this.gridService.startDrag(fromGrid, item.getItem(), item, event,{
      x: item.x() - itemPosInGrid.x,
      y: item.y() - itemPosInGrid.y,
    });

    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
      filter(() => this._dragging),
    ).subscribe(({event, dragResizeData}) => this.dragMove(event, item, dragResizeData));

    this.gridService.pointerEnd$.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(() => this._dragging),
      take(1),
    ).subscribe(() => {
      console.log('Dragging ended inside grid', this.id);
      this.items.set(this.itemComponents.map((item) => item.getItem()));
      this._dragging = false;
    });
  }

  /**
   * Moves the item while dragging
   */
  private dragMove(event: PointerEvent, item: ItemComponent, dragResizeData: IDragResizeData): void {
    const {x,y} = this.calcItemPositionInGrid(event);

    const newX = clamp(1, this.columns() - (item.width() - Math.abs(dragResizeData.itemOffset.x)) + 1, x + dragResizeData.itemOffset.x);
    const newY = clamp(1, this.rows() - (item.height() - Math.abs(dragResizeData.itemOffset.y)) + 1, y + dragResizeData.itemOffset.y);

    item.x.set(newX);
    item.y.set(newY);
  }

  private resizeStart(item: ItemComponent, event: PointerEvent, resizeType: ResizeType): void {
    this.gridService.startResize(item.getItem(), item, event);

    const initItemRect = item.element.getBoundingClientRect();
    const initResizeItem = item.getItem();

    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
    ).subscribe(({event, dragResizeData}) => this.resizeMove(event, item, resizeType, initItemRect, initResizeItem));

    this.gridService.pointerEnd$.pipe(
      takeUntilDestroyed(this.destroyRef),
      take(1),
    ).subscribe(() => {
      this.items.set(this.itemComponents.map((item) => item.getItem()));
    });
  }

  // TODO: When resizing outside the window, the scroll position is not taken into account
  private resizeMove(event: PointerEvent, item: ItemComponent, resizeType: ResizeType, initItemRect: DOMRect, initResizeItem: Item): void {
    const {cellWidth, cellHeight} = this.calcGridRectData();
    const resizeInfo = getResizeInfo(resizeType);

    let newWidth = this.gridService.getItem().width;
    let newHeight = this.gridService.getItem().height;
    let newDeltaX = this.gridService.getItem().x;
    let newDeltaY = this.gridService.getItem().y;

    // Calculate width and move item on an x-axis
    if (resizeInfo.horizontal) {
      // Resize width and move item on x-axis
      if (resizeInfo.left) {
        newDeltaX = Math.min(event.clientX + window.scrollX, initItemRect.right + window.scrollX);
        newWidth = initItemRect.right - event.clientX;
      } else {
        newWidth = event.clientX - initItemRect.left;
      }
    }

    // Calculate height and move item on y-axis
    if (resizeInfo.vertical) {
      // Resize height and move item on y-axis
      if (resizeInfo.top) {
        newDeltaY = Math.min(event.clientY + window.scrollY, initItemRect.bottom + window.scrollY);
        newHeight = initItemRect.bottom - event.clientY;
      } else {
        newHeight = event.clientY - initItemRect.top;
      }
    }

    // Force width and height to be at least 1 pixel
    newWidth = Math.max(1, newWidth);
    newHeight = Math.max(1, newHeight);
    this.gridService.resizePlaceholder(newWidth, newHeight);

    let widthCols = Math.ceil(newWidth / (cellWidth + this.colGap()));
    let heightCells = Math.ceil(newHeight / (cellHeight + this.rowGap()));

    if (resizeInfo.left) {
      widthCols = Math.min(widthCols, initResizeItem.x + initResizeItem.width - 1);
      item.width.set(Math.max(1, widthCols));
      item.x.set(Math.max(1, (initResizeItem.x + initResizeItem.width) - item.width()));
    } else {
      item.width.set(Math.max(1, Math.min(widthCols, this.columns() - item.x() + 1)));
    }

    if (resizeInfo.top) {
      heightCells = Math.min(heightCells, initResizeItem.y + initResizeItem.height - 1);
      item.height.set(Math.max(1, heightCells));
      item.y.set(Math.max(1, (initResizeItem.y + initResizeItem.height) - item.height()));
    } else {
      item.height.set(Math.max(1, Math.min(heightCells, this.rows() - item.y() + 1)));
    }
    this.gridService.movePlaceholder(newDeltaX, newDeltaY);
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

  /*
    * Calculates the cell width and height, and the delta x and y of the mouse relative to the grid
   */
  private calcGridRectData(): GridRectData {
    const gridRect = this.grid.nativeElement.getBoundingClientRect();

    const gridWidth = gridRect.width;
    const gridHeight = gridRect.height;

    const cellWidth = (gridWidth - this.colGap() * (this.columns() - 1)) / this.columns();
    const cellHeight = (gridHeight - this.rowGap() * (this.rows() - 1)) / this.rows();

    return {
      top: gridRect.top,
      left: gridRect.left,
      width: gridWidth,
      height: gridHeight,
      cellWidth,
      cellHeight
    }
  }

  private calcItemPositionInGrid(event: PointerEvent): {x: number, y: number} {
    const gridRectData = this.calcGridRectData();

    // Calculate the x and y position of the pointer relative to the grid, 0,0 is the top left corner of the grid
    const xOnGrid = clamp(1, gridRectData.width, (event.clientX + window.scrollX) - (gridRectData.left + window.scrollX));
    const yOnGrid = clamp(1, gridRectData.height, (event.clientY + window.scrollY) - (gridRectData.top + window.scrollY));

    const x = this.calcGridItemPosition(xOnGrid, gridRectData.cellWidth, this.colGap(), this.columns());
    const y = this.calcGridItemPosition(yOnGrid, gridRectData.cellHeight, this.rowGap(), this.rows());

    return {x, y};
  }

  private calcGridItemPosition(position: number, cellSize: number, gap: number, max: number): number {
    if (position <= cellSize + gap / 2) return 1;                                     // First square
    if (position >= (cellSize + gap) * (max - 1) - gap / 2) return max;               // Last square
    return Math.floor((position - (cellSize + gap / 2)) / (cellSize + gap)) + 2;   // Middle square
  }

  /**
   * TODO: Figure out how to calculate move of items when dragging/resizing, so the items move out of the way
   */
}

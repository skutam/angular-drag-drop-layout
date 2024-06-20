import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component, ContentChildren,
  effect,
  ElementRef,
  Inject,
  input,
  InputSignal, model, ModelSignal, OnDestroy, OutputRefSubscription, QueryList, ViewChild,
} from '@angular/core';
import {DOCUMENT, NgForOf} from "@angular/common";
import {ItemComponent} from "../item/item.component";
import {Item, ResizeType} from "../item/item.definitions";
import {Subscription} from "rxjs";
import {Placeholder} from "../placeholder";


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
  @ViewChild('tmp') private tmp!: ElementRef<HTMLElement>;

  // Inputs
  public columns = input(12);
  public rows = input(3);
  public colGap: InputSignal<number> = input(8);
  public rowGap: InputSignal<number> = input(8);
  public items: ModelSignal<Item[]> = model([] as Item[]);

  private itemComponentsSubscription: Subscription | null = null;
  private itemComponentSubscriptions: OutputRefSubscription[] = [];

  private gridRect: DOMRect | null = null;
  private initialX: number = 0;
  private initialY: number = 0;
  private placeholder: Placeholder;
  private initItemRect: DOMRect | null = null;
  private initResizeItem: Item | null = null;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(ElementRef) public grid: ElementRef<HTMLElement>,
  ) {
    this.registerPropertyEffect('--ddl-grid-columns', this.columns);
    this.registerPropertyEffect('--ddl-grid-rows', this.rows);
    this.registerPropertyEffect('--ddl-grid-col-gap', this.colGap, 'px');
    this.registerPropertyEffect('--ddl-grid-row-gap', this.rowGap, 'px');

    this.placeholder = new Placeholder(document);
  }

  public ngAfterViewInit(): void {
    this.itemComponentsSubscription = this.itemComponents.changes.subscribe(() => this.updateItemComponents());
    this.updateItemComponents();
  }

  public ngOnDestroy(): void {
    this.itemComponentsSubscription?.unsubscribe();
    this.itemComponentSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.itemComponentSubscriptions = [];
  }

  private registerPropertyEffect(property: string, signalValue: InputSignal<any>, append: string = ''): void {
    effect(() => {
      this.grid.nativeElement.style.setProperty(property, signalValue().toString() + append);
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

      this.itemComponentSubscriptions.push(
        // Register drag events
        item.dragStart.subscribe(({event}) => this.dragStart(event, item)),
        item.dragMove.subscribe(({event}) => this.dragMove(event, item)),
        item.dragEnd.subscribe(() => {
          this.placeholder.destroyPlaceholder()
          this.items.set(this.itemComponents.map((item) => item.getItem()));
        }),
        // Register resize events
        item.resizeStart.subscribe(() => this.resizeStart(item)),
        item.resizeMove.subscribe(({event, resizeType}) => this.resizeMove(event, item, resizeType)),
        item.resizeEnd.subscribe(() => {
          this.placeholder.destroyPlaceholder()
          this.items.set(this.itemComponents.map((item) => item.getItem()));
        }),
      );
    });
  }

  /**
   * Starts dragging an item
   */
  private dragStart(event: PointerEvent, item: ItemComponent): void {
    this.gridRect = this.grid.nativeElement.getBoundingClientRect();
    const {width, height, x, y} = item.element.getBoundingClientRect();

    this.initialX = event.clientX;
    this.initialY = event.clientY;

    this.placeholder.createPlaceholder(width, height, x, y);
  }

  /**
   * Moves the item while dragging
   */
  private dragMove(event: PointerEvent, item: ItemComponent): void {
    // Get position of mouse relative to grid TODO: Optimize this, so it only gets calculated once in the dragStart
    const {cellWidth, cellHeight} = this.calcGridMetrics(event);

    const newDeltaX = this.placeholder.x - (this.initialX - event.clientX);
    const newDeltaY = this.placeholder.y - (this.initialY - event.clientY);

    const newX = Math.floor((cellWidth + newDeltaX) / cellWidth);
    const newY = Math.floor((cellHeight + newDeltaY) / cellHeight);

    item.x.set(Math.max(1, Math.min(newX, this.columns() - item.width() + 1)));
    item.y.set(Math.max(1, Math.min(newY, this.rows() - item.height() + 1)));

    this.placeholder.movePlaceholder(newDeltaX, newDeltaY);
  }

  private resizeStart(item: ItemComponent): void {
    this.gridRect = this.grid.nativeElement.getBoundingClientRect();
    this.initItemRect = item.element.getBoundingClientRect();
    this.initResizeItem = item.getItem();
    this.placeholder.createPlaceholder(this.initItemRect.width, this.initItemRect.height, this.initItemRect.x, this.initItemRect.y);
  }

  // TODO: After fixing, try to combine dragMove and resizeMove into one function and try to optimize and simplify the code
  // TODO: Refactor the code to make it more readable and maintainable
  private resizeMove(event: PointerEvent, item: ItemComponent, resizeType: ResizeType): void {
    const {cellWidth, cellHeight} = this.calcGridMetrics(event);

    let newWidth = this.placeholder.width;
    let newHeight = this.placeholder.height;
    let newDeltaX = this.placeholder.x;
    let newDeltaY = this.placeholder.y;

    // Calculate width and move item on an x-axis
    switch (resizeType) {
      case 'top-right':
      case 'top-left':
      case 'bottom-left':
      case 'bottom-right':
      case 'right':
      case 'left':
        // Resize width and move item on x axis
        if (resizeType === 'left' || resizeType === 'top-left' || resizeType === 'bottom-left') {
          newDeltaX = Math.min(event.clientX, this.initItemRect!.right);
          newWidth = this.initItemRect!.right - event.clientX;
        } else {
          newWidth = event.clientX - this.initItemRect!.left;
        }
        break;
    }

    // Calculate height and move item on y axis
    switch (resizeType) {
      case 'top':
      case 'top-left':
      case 'top-right':
      case 'bottom':
      case 'bottom-left':
      case 'bottom-right':
        // Resize height and move item on y axis
        if (resizeType === 'top' || resizeType === 'top-left' || resizeType === 'top-right') {
          newDeltaY = Math.min(event.clientY, this.initItemRect!.bottom);
          newHeight = this.initItemRect!.bottom - event.clientY;
        } else {
          newHeight = event.clientY - this.initItemRect!.top;
        }
        break;
    }

    // Force width and height to be at least 1 pixel
    newWidth = Math.max(1, newWidth);
    newHeight = Math.max(1, newHeight);

    let widthCols = Math.ceil(newWidth / (cellWidth + this.colGap()));
    let heightCells = Math.ceil(newHeight / (cellHeight + this.rowGap()));

    //
    switch (resizeType) {
      case 'bottom-left':
      case 'left':
      case 'top-left':
        widthCols = Math.min(widthCols, this.initResizeItem!.x + this.initResizeItem!.width - 1);
        item.width.set(Math.max(1, widthCols));
        break;

      default:
        item.width.set(Math.max(1, Math.min(widthCols, this.columns() - item.x() + 1)));
        break;
    }

    switch (resizeType) {
      case 'top-left':
      case 'top':
      case 'top-right':
        heightCells = Math.min(heightCells, this.initResizeItem!.y + this.initResizeItem!.height - 1);
        item.height.set(Math.max(1, heightCells));
        break;
      default:
        item.height.set(Math.max(1, Math.min(heightCells, this.rows() - item.y() + 1)));
        break;
    }
    this.placeholder.resizePlaceholder(newWidth, newHeight);

    // Calculate move only when resizing the item on the anchor points
    switch (resizeType) {
      case 'bottom-left':
      case 'left':
      case 'top-left':
      case 'top':
      case 'top-right':
        if (resizeType === 'top' || resizeType === 'top-left' || resizeType === 'top-right') {
          item.y.set(Math.max(1, (this.initResizeItem!.y + this.initResizeItem!.height) - item.height()));
        }
        if (resizeType === 'left' || resizeType === 'top-left' || resizeType === 'bottom-left') {
          item.x.set(Math.max(1, (this.initResizeItem!.x + this.initResizeItem!.width) - item.width()));
        }
        this.placeholder.movePlaceholder(newDeltaX, newDeltaY);
        break;
    }
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
  private calcGridMetrics(event: PointerEvent) {
    const deltaX = event.clientX - this.gridRect!.left;
    const deltaY = event.clientY - this.gridRect!.top;

    const gridWidth = this.gridRect!.width;
    const gridHeight = this.gridRect!.height;

    // const cellWidth = (gridWidth - this.colGap()) / this.columns();
    // const cellHeight = (gridHeight - this.rowGap()) / this.rows();

    const cellWidth = (gridWidth - this.colGap() * (this.columns() - 1)) / this.columns();
    const cellHeight = (gridHeight - this.rowGap() * (this.rows() - 1)) / this.rows();
    return {deltaX, deltaY, cellWidth, cellHeight};
  }

  /**
   * TODO: Figure out how to calculate move of items when dragging/resizing, so the items move out of the way
   */
}

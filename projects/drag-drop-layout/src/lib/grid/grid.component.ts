import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component, ContentChildren,
  effect,
  ElementRef,
  Inject,
  input,
  InputSignal, model, ModelSignal, OnDestroy, OutputRefSubscription, QueryList,
} from '@angular/core';
import {DOCUMENT, NgForOf} from "@angular/common";
import {ItemComponent} from "../item/item.component";
import {Item} from "../item/item.definitions";
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

  // Inputs
  public columns = input(12);
  public rows = input(3);
  public colGap: InputSignal<number> = input(8);
  public rowGap: InputSignal<number> = input(8);
  public items: ModelSignal<Item[]> = model([] as Item[]);

  private itemComponentsSubscription: Subscription | null = null;
  private itemComponentSubscriptions: OutputRefSubscription[] = [];

  private gridRect: DOMRect | null = null;
  private placeholder;

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
      item.grid = this;
      item.id = itemData.id;
      item.x.set(itemData.x);
      item.y.set(itemData.y);
      item.width.set(itemData.width);
      item.height.set(itemData.height);

      this.itemComponentSubscriptions.push(
        item.dragStart.subscribe(({event}) => this.dragStart(event, item)),
        item.dragMove.subscribe(({event}) => this.dragMove(event, item)),
        item.dragEnd.subscribe(() => {
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
    const {deltaX, deltaY, cellWidth, cellHeight} = this.calcGridMetrics(event);

    const width = cellWidth * item.width();
    const height = cellHeight * item.height();

    this.placeholder.createPlaceholder(width, height, deltaX, deltaY)
  }

  /**
   * Moves the item while dragging
   */
  private dragMove(event: PointerEvent, item: ItemComponent): void {
    // Get position of mouse relative to grid
    const {deltaX, deltaY, cellWidth, cellHeight} = this.calcGridMetrics(event);

    const newX = Math.floor((cellWidth + deltaX) / cellWidth);
    const newY = Math.floor((cellHeight + deltaY) / cellHeight);

    item.x.set(Math.max(0, Math.min(newX, this.columns())));
    item.y.set(Math.max(0, Math.min(newY, this.rows())));

    this.placeholder.movePlaceholder(deltaX, deltaY);
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

    const cellWidth = (gridWidth - this.colGap()) / this.columns();
    const cellHeight = (gridHeight - this.rowGap()) / this.rows();
    return {deltaX, deltaY, cellWidth, cellHeight};
  }

  /**
   * TODO: Figure out how to calculate move of items when dragging/resizing, so the items move out of the way
   */
}

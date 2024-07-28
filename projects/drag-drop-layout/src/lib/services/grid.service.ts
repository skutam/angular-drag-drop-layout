import {DestroyRef, Inject, Injectable, NgZone} from '@angular/core';
import {Item} from "../item/item.definitions";
import {ItemComponent} from "../item/item.component";
import {
  filter,
  fromEvent,
  Observable,
  sampleTime,
  Subject,
} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {GridComponent} from "../grid/grid.component";
import {GridDragItemService} from "./grid-drag-item.service";
import {Placeholder} from "../placeholder";
import {IDragResizeData, IGridPointerEvent} from "../grid/grid.definitions";
import {DOCUMENT} from "@angular/common";


@Injectable({
  providedIn: 'root'
})
export class GridService extends Placeholder {
  private dragResizeData: IDragResizeData | null = null;

  public pointerMove$: Observable<IGridPointerEvent>;
  private pointerMoveSubject: Subject<IGridPointerEvent> = new Subject<IGridPointerEvent>();

  public pointerEnd$: Observable<IGridPointerEvent>;
  private pointerEndSubject: Subject<IGridPointerEvent> = new Subject<IGridPointerEvent>();

  constructor(
    private destroyRef: DestroyRef,
    private ngZone: NgZone,
    private gridDragItemService: GridDragItemService,
    @Inject(DOCUMENT) private document: Document,
  ) {
    super(document);
    this.pointerMove$ = this.pointerMoveSubject.asObservable();
    this.pointerEnd$ = this.pointerEndSubject.asObservable();

    this.ngZone.runOutsideAngular(() => {
      fromEvent<PointerEvent>(this.document, 'pointermove').pipe(
        sampleTime(10),
        takeUntilDestroyed(this.destroyRef),
        filter(() => this.dragResizeData !== null),
      ).subscribe((event: PointerEvent) => {
        // Calculate movement only when dragging, resize handles it on its own
        if (this.dragResizeData!.dragging) {
          this.handleGridPointerMove(event);

          const newDeltaX = event.clientX + this.dragResizeData!.dragOffset.x + window.scrollX;
          const newDeltaY = event.clientY + this.dragResizeData!.dragOffset.y + window.scrollY;
          this.movePlaceholder(newDeltaX, newDeltaY);
        }

        this.pointerMoveSubject.next({
          event,
          dragResizeData: this.dragResizeData!,
        });
      });

      fromEvent<PointerEvent>(this.document, 'pointerup').pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(() => this.dragResizeData !== null),
      ).subscribe((event: PointerEvent) => {
        this.dragResizeData = null;
        this.destroyPlaceholder();
        this.pointerEndSubject.next({
          event,
          dragResizeData: this.dragResizeData!,
        });
      });
    });
  }

  public startDrag(fromGrid: GridComponent | null, item: Item,
                   itemComponent: ItemComponent, event: PointerEvent,
                   itemOffset: {x: number, y: number}): void {
    console.log('Start drag', item);
    const {width, height, x, y} = itemComponent.element.getBoundingClientRect();
    this.createPlaceholder(width, height, x + window.scrollX, y + window.scrollY);

    this.dragResizeData = {
      fromGrid,
      item,
      itemComponent,
      dragging: true,
      currentGrid: null,
      previousGrid: null,
      dragOffset: {
        x: x - event.clientX,
        y: y - event.clientY,
      },
      itemOffset
    };
  }

  public startItemDrag(item: Item, event: PointerEvent, dragOffset: {x: number, y: number}) {
    this.dragResizeData = {
      fromGrid: null,
      item,
      itemComponent: null,
      dragging: true,
      currentGrid: null,
      previousGrid: null,
      dragOffset,
      itemOffset: {
        x: 0,
        y: 0,
      },
    };
  }

  public startResize(item: Item, itemComponent: ItemComponent, event: PointerEvent): void {
    const {width, height, x, y} = itemComponent.element.getBoundingClientRect();
    this.createPlaceholder(width, height, x + window.scrollX, y + window.scrollY);

    this.dragResizeData = {
      fromGrid: null,
      item,
      itemComponent,
      dragging: false,
      currentGrid: null,
      previousGrid: null,
      dragOffset: {
        x: x - event.clientX,
        y: y - event.clientY,
      },
      itemOffset: {
        x: 0,
        y: 0,
      },
    }
  }

  /**
   * Handle the pointer move event, by checking if the item entered a new grid or left the current grid.
   * If the item entered a new grid, the dragEnter event is emitted on the new grid.
   * If the item left the current grid, the dragLeave event is emitted on the current grid.
   */
  private handleGridPointerMove(event: PointerEvent): void {
    if (this.dragResizeData === null) {
      return;
    }

    // Check if the item being dragged is still inside the same grid
    if (this.dragResizeData.currentGrid !== null) {
      if (this.dragResizeData.currentGrid.eventInsideGrid(event)) {
        return;
      }
    }

    // Not inside the same grid, notify previous grid
    this.dragResizeData.previousGrid = this.dragResizeData.currentGrid;
    this.dragResizeData.previousGrid?.dragLeave.emit({
      grid: this.dragResizeData.previousGrid,
      event,
      item: this.dragResizeData.item,
    });

    // Find the new grid and notify it
    this.dragResizeData.currentGrid = this.gridDragItemService.getGrids().find((grid) => grid.eventInsideGrid(event)) || null;
    this.dragResizeData.currentGrid?.dragEnter.emit({
      grid: this.dragResizeData.currentGrid,
      event,
      item: this.dragResizeData.item,
    });
  }
}

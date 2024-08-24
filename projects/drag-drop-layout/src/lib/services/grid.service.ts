import {DestroyRef, Inject, Injectable, NgZone} from '@angular/core';
import {Item} from "../item/item.definitions";
import {ItemComponent} from "../item/item.component";
import {
  auditTime,
  filter,
  fromEvent,
  Observable,
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
        auditTime(10),
        takeUntilDestroyed(this.destroyRef),
        filter(() => this.dragResizeData !== null),
      ).subscribe((event: PointerEvent) => {
        // Calculate movement only when dragging, resize handles it on its own
        if (this.dragResizeData!.dragging) {
          this.handleGridEnterLeaveEvents(event);

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
        this.destroyPlaceholder();
        this.pointerEndSubject.next({
          event,
          dragResizeData: this.dragResizeData!,
        });
        this.dragResizeData = null;
      });
    });
  }

  public startDrag(fromGrid: GridComponent | null, item: Item,
                   itemComponent: ItemComponent, event: PointerEvent,
                   itemOffset: { x: number, y: number }): void {
    const {width, height, x, y} = itemComponent.element.getBoundingClientRect();
    this.createPlaceholder(width, height, x + window.scrollX, y + window.scrollY);

    this.dragResizeData = {
      fromGrid,
      item,
      dragItemElement: null,
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

  public startItemDrag(item: Item, element: HTMLElement, event: PointerEvent) {
    const {width, height, x, y} = element.getBoundingClientRect();
    this.createPlaceholder(width, height, x + window.scrollX, y + window.scrollY);

    this.dragResizeData = {
      fromGrid: null,
      item,
      dragItemElement: element,
      dragging: true,
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
    };
  }

  public startResize(item: Item, itemComponent: ItemComponent, event: PointerEvent): void {
    const {width, height, x, y} = itemComponent.element.getBoundingClientRect();
    this.createPlaceholder(width, height, x + window.scrollX, y + window.scrollY);

    this.dragResizeData = {
      fromGrid: null,
      item,
      dragItemElement: null,
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
  private handleGridEnterLeaveEvents(event: PointerEvent): void {
    // Check if the item being dragged is still inside the same grid
    if (this.dragResizeData!.currentGrid !== null) {
      if (this.dragResizeData!.currentGrid.eventInsideGrid(event)) {
        return;
      }
    }

    // Not inside the same grid, notify previous grid
    this.dragResizeData!.previousGrid = this.dragResizeData!.currentGrid;
    this.dragResizeData!.previousGrid?.dragLeave.emit({
      event,
      item: this.dragResizeData!.item,
      dragItemElement: this.dragResizeData!.dragItemElement
    });

    // Find the new grid and notify it
    this.dragResizeData!.currentGrid = this.gridDragItemService.getGrids().find((grid) => grid.eventInsideGrid(event)) || null;
    this.dragResizeData!.currentGrid?.dragEnter.emit({
      event,
      item: this.dragResizeData!.item,
      dragItemElement: this.dragResizeData!.dragItemElement
    });
  }
}

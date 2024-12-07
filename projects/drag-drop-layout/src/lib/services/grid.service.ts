import {DestroyRef, Inject, Injectable, NgZone} from '@angular/core';
import {Item} from "../item/item.definitions";
import {ItemComponent} from "../item/item.component";
import {
  auditTime,
  combineLatest,
  filter,
  fromEvent,
  map,
  merge,
  Observable,
  of,
  startWith,
  Subject,
  Subscription,
} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {GridComponent} from "../grid/grid.component";
import {GridDragItemService} from "./grid-drag-item.service";
import {Placeholder} from "../placeholder";
import {IDragResizeData, IGridPointerEvent} from "../grid/grid.definitions";
import {DOCUMENT} from "@angular/common";
import {IPosition} from "../definitions";
import {getScrollOffset} from "../util";


@Injectable({
  providedIn: 'root'
})
export class GridService extends Placeholder {
  private dragResizeData: IDragResizeData | null = null;

  public pointerMove$: Observable<IGridPointerEvent>;
  private pointerMoveSubject: Subject<IGridPointerEvent> = new Subject<IGridPointerEvent>();
  private pointerMoveSubscription: Subscription | null = null;

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
      fromEvent<PointerEvent>(this.document, 'pointerup').pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(() => this.dragResizeData !== null),
      ).subscribe((event: PointerEvent) => {
        this.destroyPlaceholder();
        this.pointerEndSubject.next({
          event: {
            x: event.clientX,
            y: event.clientY,
          },
          dragResizeData: this.dragResizeData!,
          scroll: getScrollOffset(this.dragResizeData!.scrollElement),
        });

        this.dragResizeData = null;
        this.pointerMoveSubscription?.unsubscribe();
        this.pointerMoveSubscription = null;
      });
    });
  }

  /**
   * Register the pointer move event, and emit the pointer move event when the pointer is moved. We are registering
   * it each time a drag starts, because we need to know when the pointer is moved, and what the scrollable element is.
   * @param scrollableElement
   * @private
   */
  private registerPointerMoveEvent(scrollableElement: HTMLElement | Document | null): void {
    this.ngZone.runOutsideAngular(() => {
      let observable: Observable<[PointerEvent, IPosition]>;
      if (scrollableElement === null) {
        observable = merge(
          combineLatest([
            fromEvent<PointerEvent>(this.document, 'pointermove').pipe(
              auditTime(10),
              takeUntilDestroyed(this.destroyRef),
              filter(() => this.dragResizeData !== null),
            ),
            of({x: 0, y: 0}),
          ])
        );
      } else {
        observable = merge(
          combineLatest([
            fromEvent<PointerEvent>(this.document, 'pointermove').pipe(
              auditTime(10),
              takeUntilDestroyed(this.destroyRef),
              filter(() => this.dragResizeData !== null),
            ),
            fromEvent<Event>(scrollableElement, 'scroll').pipe(
              auditTime(10),
              map(() => getScrollOffset(scrollableElement)),
              startWith(getScrollOffset(scrollableElement)),
            )
          ])
        );
      }

      this.pointerMoveSubscription = observable.subscribe(([event, scroll]) => {
        // Calculate movement only when dragging, resize handles it on its own
        if (this.dragResizeData!.dragging) {
          this.handleGridEnterLeaveEvents(event);

          const newDeltaX = event.clientX + this.dragResizeData!.dragOffset.x + scroll.x;
          const newDeltaY = event.clientY + this.dragResizeData!.dragOffset.y + scroll.y;
          this.movePlaceholder(newDeltaX, newDeltaY);
        }

        this.pointerMoveSubject.next({
          event,
          dragResizeData: this.dragResizeData!,
          scroll,
        });
      });
    });
  }

  public startDrag(fromGrid: GridComponent | null, item: Item,
                   itemComponent: ItemComponent, mousePos: IPosition,
                   itemOffset: { x: number, y: number }, scrollElement: HTMLElement | Document | null): void {
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
        x: x - mousePos.x,
        y: y - mousePos.y,
      },
      itemOffset,
      scrollElement,
    };

    this.registerPointerMoveEvent(scrollElement);
  }

  public startItemDrag(item: Item, element: HTMLElement, event: PointerEvent, scrollElement: HTMLElement | Document | null): void {
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
      scrollElement,
    };

    this.registerPointerMoveEvent(scrollElement);
  }

  public startResize(item: Item, itemComponent: ItemComponent, mousePos: IPosition, scrollElement: HTMLElement | Document | null): void {
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
        x: x - mousePos.x,
        y: y - mousePos.y,
      },
      itemOffset: {
        x: 0,
        y: 0,
      },
      scrollElement,
    };

    this.registerPointerMoveEvent(scrollElement);
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
      dragResizeData: this.dragResizeData!,
      scroll: getScrollOffset(this.dragResizeData!.scrollElement),
    });

    // Find the new grid and notify it
    this.dragResizeData!.currentGrid = this.gridDragItemService.getGrids().find((grid) => grid.eventInsideGrid(event)) || null;
    this.dragResizeData!.currentGrid?.dragEnter.emit({
      event,
      item: this.dragResizeData!.item,
      dragResizeData: this.dragResizeData!,
      scroll: getScrollOffset(this.dragResizeData!.scrollElement),
    });
  }
}

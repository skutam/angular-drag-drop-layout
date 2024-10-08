import {DestroyRef, Directive, ElementRef, HostListener, Inject, input, OnDestroy, output} from '@angular/core';
import {GridDragItemService} from "../services/grid-drag-item.service";
import {Item} from "../item/item.definitions";
import {GridService} from "../services/grid.service";
import {take, takeUntil} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Directive({
  selector: '[ddlDragItem]',
  host: {
    '[draggable]': 'draggable() && !disabled()',
    '[disabled]': 'disabled()',
    '[style.cursor]': 'disabled() ? "not-allowed" : (draggable() ? "move" : "default")',
  },
})
export class DragItemDirective implements OnDestroy {
  private static dragItemIdCounter: number = 0;
  public id: string = `${DragItemDirective.dragItemIdCounter++}`;

  // Inputs
  public draggable = input(true);
  public disabled = input(false);
  public width = input(1);
  public height = input(1);
  public dragData = input<any>();

  // Outputs
  public dragStart = output<PointerEvent>();
  public dragMove = output<PointerEvent>();
  public dragEnd = output<PointerEvent>();

  @HostListener('pointerdown', ['$event'])
  public startDrag(event: PointerEvent) {
    /**
     * Only start dragging if the left mouse button is pressed.
     * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#determining_button_states
     */
    if (event.button !== 0 && event.buttons !== 1) {
      return;
    }

    if (!this.draggable() || this.disabled()) {
      return;
    }

    event.preventDefault();

    this.dragStart.emit(event);
    this.gridService.startItemDrag(this.getItem(), this.dragItem.nativeElement, event);

    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
    ).subscribe(({event}) => this.dragMove.emit(event));

    this.gridService.pointerEnd$.pipe(
      takeUntilDestroyed(this.destroyRef),
      take(1),
    ).subscribe(({event}) => this.dragEnd.emit(event));
  }

  public constructor(
    private gridDragItemService: GridDragItemService,
    private gridService: GridService,
    @Inject(ElementRef) public dragItem: ElementRef<HTMLElement>,
    private destroyRef: DestroyRef,
  ) { }

  public ngOnDestroy(): void {
    this.gridDragItemService.unregisterItem(this);
  }

  public getItem(): Item {
    return new Item('dragItem', 0, 0, this.width(), this.height(), this.dragData());
  }
}

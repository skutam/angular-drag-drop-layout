import {Directive, ElementRef, HostListener, Inject, input, OnDestroy, output} from '@angular/core';
import {GridDragItemService} from "../services/grid-drag-item.service";
import {Item} from "../item/item.definitions";

@Directive({
  selector: '[ddlDragItem]',
  standalone: true,
  host: {
    '[draggable]': 'draggable()',
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
  public dragData = input<any>();

  public width = input(1);
  public height = input(1);

  // Outputs
  public dragStart = output<PointerEvent>();
  public dragMove = output<PointerEvent>();
  public dragEnd = output<PointerEvent>();

  private _dragging: boolean = false;

  @HostListener('pointerdown', ['$event'])
  private startDrag(event: PointerEvent) {
    /**
     * Only start dragging if the left mouse button is pressed.
     * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#determining_button_states
     */
    if (!this.draggable() || event.button !== 0 && event.buttons !== 1) {
      return;
    }

    this._dragging = true;
    this.dragStart.emit(event);
    event.preventDefault();
  }

  // TODO: Add debounce to this, so that it doesn't fire too often
  @HostListener('document:pointermove', ['$event'])
  protected moveDrag(event: PointerEvent) {
    if (!this._dragging) {
      return;
    }

    this.dragMove.emit(event);
    event.preventDefault();
  }

  @HostListener('document:pointerup', ['$event'])
  protected dragResizeEnd(event: PointerEvent) {
    if (!this._dragging) {
      return;
    }

    this.dragEnd.emit(event);
    this._dragging = false;
    event.preventDefault();
  }

  public constructor(
    @Inject(ElementRef) private item: ElementRef<HTMLElement>,
    private gridDragItemService: GridDragItemService,
  ) { }

  public ngOnDestroy(): void {
    this.gridDragItemService.unregisterItem(this);
  }

  public getItem(): Item {
    return new Item(
      this.id,
      0,
      0,
      this.width(),
      this.height());
  }
}

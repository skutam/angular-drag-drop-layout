import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren, DestroyRef,
  effect,
  ElementRef,
  HostListener,
  Inject,
  input,
  InputSignal,
  OnDestroy,
  output,
  OutputRefSubscription,
  QueryList,
  Signal,
  signal,
} from '@angular/core';
import {Item, ItemDragEvent, ItemResizeEvent, ResizeType} from "./item.definitions";
import {DragHandleDirective} from "../directives/drag-handle.directive";
import {take, takeUntil} from "rxjs";
import {GridService} from "../services/grid.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

/**
 * Item component that can be dragged and resized.
 * This class is mainly responsible for handling the drag and resize events and also for updating the item's position and size.
 */
@Component({
  selector: 'ddl-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item.component.html',
  styleUrl: './item.component.css',
  host: {
    '[draggable]': 'draggable() && dragHandles.length === 0',
    '[disabled]': 'disabled()',
    '[style.cursor]': 'disabled() ? "not-allowed" : (draggable() && dragHandles.length === 0 ? "move" : "default")',
  },
})
// TODO: Add change indicator to this class, so when resizing/dragging we know when to recalculate the position of other items
export class ItemComponent implements AfterViewInit, OnDestroy {
  public id: string = `${crypto.randomUUID()}`;

  @ContentChildren(DragHandleDirective, {descendants: true}) protected dragHandles!: QueryList<DragHandleDirective>;

  // Will be updated from grid
  public x = signal(0);
  public y = signal(0);
  public width = signal(1);
  public height = signal(1);
  public data = signal<any>(undefined);

  // Inputs
  public resizeTypes: InputSignal<ResizeType[]> = input(['bottom-left'] as ResizeType[]);
  public draggable = input(true);
  public resizable = input(true);
  public disabled = input(false);

  // Outputs
  public dragStart = output<ItemDragEvent>();
  public dragMove = output<ItemDragEvent>();
  public dragEnd = output<ItemDragEvent>();
  public resizeStart = output<ItemResizeEvent>();
  public resizeMove = output<ItemResizeEvent>();
  public resizeEnd = output<ItemResizeEvent>();

  @HostListener('pointerdown', ['$event'])
  public hostStartDrag(event: PointerEvent) {
    if (!this.draggable()) {
      return;
    }
    /**
     * Only start dragging if the left mouse button is pressed.
     * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#determining_button_states
     */
    if (event.button !== 0 && event.buttons !== 1) {
      return;
    }

    // When there are no drag handles, the whole item can be dragged.
    if (this.dragHandles.length !== 0) {
      return;
    }

    // Check if the event target is the element itself, not a child element.
    if (event.target !== this.item.nativeElement) {
      return;
    }

    this.startDrag(event);
  }

  private dragHandleDragStartSubscriptions: OutputRefSubscription[] = [];

  public element: HTMLDivElement;

  public constructor(
    @Inject(ElementRef) private item: ElementRef<HTMLDivElement>,
    private gridService: GridService,
    private destroyRef: DestroyRef,
  ) {
    this.registerPropertyEffect('--ddl-item-x', this.x);
    this.registerPropertyEffect('--ddl-item-y', this.y);
    this.registerPropertyEffect('--ddl-item-width', this.width);
    this.registerPropertyEffect('--ddl-item-height', this.height);
    this.element = this.item.nativeElement;
  }

  public ngAfterViewInit(): void {
    this.dragHandles.changes.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.registerDragHandles());
    this.registerDragHandles();
  }

  public ngOnDestroy(): void {
    this.dragHandleDragStartSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.dragHandleDragStartSubscriptions = [];
  }

  private registerDragHandles(): void {
    // Set cursor
    this.item.nativeElement.style.cursor = this.dragHandles.length === 0 && this.draggable() ? 'move' : 'default';

    // Unsubscribe from previous drag handles
    this.dragHandleDragStartSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.dragHandleDragStartSubscriptions = [];

    this.dragHandles.forEach((dragHandle) => {
      dragHandle.draggable = this.draggable;
      dragHandle.disabled = this.disabled;
    });

    // Subscribe to new drag handles
    if (this.draggable()) {
      this.dragHandleDragStartSubscriptions.push(
        ...this.dragHandles.map((dragHandle) => dragHandle.dragStart.subscribe((event) => this.startDrag(event)))
      );
    }
  }

  private startDrag(event: PointerEvent): void {
    event.preventDefault();

    this.dragStart.emit({
      item: this.getItem(),
      event: event,
    });

    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
    ).subscribe(({event}) => {
      this.dragMove.emit({
        item: this.getItem(),
        event: event,
      });
    });

    this.gridService.pointerEnd$.pipe(
      takeUntilDestroyed(this.destroyRef),
      take(1),
    ).subscribe(({event}) => {
      this.dragEnd.emit({
        item: this.getItem(),
        event: event,
      });
    });
  }

  public startResize(event: PointerEvent, resizeType: ResizeType): void {
    event.preventDefault();
    event.stopPropagation();

    this.resizeStart.emit({
      item: this.getItem(),
      event: event,
      resizeType: resizeType,
    });

    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
    ).subscribe(({event}) => this.resizeMove.emit({
      item: this.getItem(),
      event: event,
      resizeType: resizeType,
    }))

    this.gridService.pointerEnd$.pipe(
      takeUntilDestroyed(this.destroyRef),
      take(1),
    ).subscribe(({event}) => this.resizeEnd.emit({
      item: this.getItem(),
      event: event,
      resizeType: resizeType,
    }));
  }

  private registerPropertyEffect(property: string, signalValue: Signal<any>): void {
    effect(() => {
      this.item.nativeElement.style.setProperty(property, signalValue().toString());
    });
  }

  public getItem(): Item {
    return new Item(this.id, this.x(), this.y(), this.width(), this.height(), this.data());
  }
}

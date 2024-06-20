import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  effect,
  ElementRef, EventEmitter,
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
import {Subscription} from "rxjs";
import {NgForOf} from "@angular/common";


@Component({
  selector: 'ddl-item',
  standalone: true,
  imports: [
    NgForOf
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item.component.html',
  styleUrl: './item.component.css',
})
export class ItemComponent implements AfterViewInit, OnDestroy {
  protected static itemIdCounter: number = 0;
  public id: string = `${ItemComponent.itemIdCounter++}`;

  @ContentChildren(DragHandleDirective, {descendants: true}) protected dragHandles!: QueryList<DragHandleDirective>;

  // Will be updated from grid
  public x = signal(0);
  public y = signal(0);
  public width = signal(1);
  public height = signal(1);

  // TODO: Emit when one of the properties x,y,width,height changes, this will force the grid to reposition the other items
  public itemChanged: EventEmitter<Item> = new EventEmitter<Item>();

  // Inputs
  public resizeTypes: InputSignal<ResizeType[]> = input(['bottom-left'] as ResizeType[]);

  // Outputs
  public dragStart = output<ItemDragEvent>();
  public dragMove = output<ItemDragEvent>();
  public dragEnd = output<ItemDragEvent>();
  public resizeStart = output<ItemResizeEvent>();
  public resizeMove = output<ItemResizeEvent>();
  public resizeEnd = output<ItemResizeEvent>();

  private _dragging: boolean = false;
  private _resizing: boolean = false;
  private resizeType: ResizeType = 'bottom-right';

  public startResize(event: PointerEvent, resizeType: ResizeType): void {
    this._resizing = true;
    this.resizeType = resizeType;

    this.resizeStart.emit({
      item: this.getItem(),
      event: event,
      resizeType: resizeType,
    });

    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('pointerdown', ['$event'])
  protected hostStartDrag(event: PointerEvent) {
    /**
     * Only start dragging if the left mouse button is pressed.
     * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#determining_button_states
     */
    if (event.button !== 0 && event.buttons !== 1) {
      return;
    }

    if (this.dragHandles.length === 0) {
      this.startDrag(event);
    }
  }

  // TODO: Add debounce to this, so that it doesn't fire too often
  @HostListener('document:pointermove', ['$event'])
  protected dragResizeMove(event: PointerEvent) {
    if (!this._dragging && !this._resizing) {
      return;
    }

    if (this._dragging) {
      this.dragMove.emit({
        item: this.getItem(),
        event: event,
      });
    } else {
      this.resizeMove.emit({
        item: this.getItem(),
        event: event,
        resizeType: this.resizeType,
      });
    }
    event.preventDefault();
  }

  @HostListener('document:pointerup', ['$event'])
  protected dragResizeEnd(event: PointerEvent) {
    if (!this._dragging && !this._resizing) {
      return;
    }

    if (this._dragging) {
      this.dragEnd.emit({
        item: this.getItem(),
        event: event,
      });
    } else {
      this.resizeEnd.emit({
        item: this.getItem(),
        event: event,
        resizeType: this.resizeType,
      });
    }
    this._dragging = false;
    this._resizing = false;
    event.preventDefault();
  }

  private dragHandleSubscription: Subscription | null = null;
  private dragHandleDragStartSubscriptions: OutputRefSubscription[] = [];

  public element: HTMLDivElement;

  public constructor(
    @Inject(ElementRef) private item: ElementRef<HTMLDivElement>,
  ) {
    this.registerPropertyEffect('--ddl-item-x', this.x);
    this.registerPropertyEffect('--ddl-item-y', this.y);
    this.registerPropertyEffect('--ddl-item-width', this.width);
    this.registerPropertyEffect('--ddl-item-height', this.height);
    this.element = this.item.nativeElement;
  }

  public ngAfterViewInit(): void {
    this.dragHandleSubscription = this.dragHandles.changes.subscribe(() => this.registerDragHandles());
    this.registerDragHandles();
  }

  public ngOnDestroy(): void {
    this.dragHandleSubscription?.unsubscribe();
    this.dragHandleDragStartSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.dragHandleDragStartSubscriptions = [];
  }

  private registerDragHandles(): void {
    // Set cursor
    this.item.nativeElement.style.cursor = this.dragHandles.length === 0 ? 'move' : 'default';

    // Unsubscribe from previous drag handles
    this.dragHandleDragStartSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.dragHandleDragStartSubscriptions = [];

    // Subscribe to new drag handles
    this.dragHandleDragStartSubscriptions.push(
      ...this.dragHandles.map((dragHandle) => {
        return dragHandle.dragStart.subscribe((event) => this.startDrag(event));
      })
    )
  }

  private startDrag(event: PointerEvent): void {
    this._dragging = true;
    this.dragStart.emit({
      item: this.getItem(),
      event: event,
    });
    event.preventDefault();
  }

  private registerPropertyEffect(property: string, signalValue: Signal<any>): void {
    effect(() => {
      this.item.nativeElement.style.setProperty(property, signalValue().toString());
    });
  }

  public getItem(): Item {
    return new Item(
      this.id,
      this.x(),
      this.y(),
      this.width(),
      this.height());
  }
}

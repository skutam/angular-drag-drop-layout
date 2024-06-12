import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component, ContentChildren, effect,
  ElementRef, HostListener, Inject, OnDestroy, output, OutputRefSubscription, QueryList, Signal, signal,
} from '@angular/core';
import {GridComponent} from "../grid/grid.component";
import {Item, ItemDragEvent} from "./item.definitions";
import {DragHandleDirective} from "../directives/drag-handle.directive";
import {Subscription} from "rxjs";


@Component({
  selector: 'ddl-item',
  standalone: true,
  imports: [],
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
  public grid!: GridComponent;

  // Inputs

  // Outputs
  public dragStart = output<ItemDragEvent>();
  public dragMove = output<ItemDragEvent>();
  public dragEnd = output<ItemDragEvent>();

  private _dragging: boolean = false;

  @HostListener('pointerdown', ['$event'])
  public hostStartDrag(event: PointerEvent) {
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

  @HostListener('document:pointermove', ['$event'])
  public drag(event: PointerEvent) {
    if (!this._dragging) {
      return;
    }

    this.dragMove.emit({
      item: this.getItem(),
      event: event,
    });
    event.preventDefault();
  }

  @HostListener('document:pointerup', ['$event'])
  public endDrag(event: PointerEvent) {
    if (!this._dragging) {
      return;
    }

    this.dragEnd.emit({
      item: this.getItem(),
      event: event,
    });
    this._dragging = false;
    event.preventDefault();
  }

  private dragHandleSubscription: Subscription | null = null;
  private dragHandleDragStartSubscriptions: OutputRefSubscription[] = [];

  public constructor(
    @Inject(ElementRef) private item: ElementRef<HTMLDivElement>,
  ) {
    this.registerPropertyEffect('--ddl-item-x', this.x);
    this.registerPropertyEffect('--ddl-item-y', this.y);
    this.registerPropertyEffect('--ddl-item-width', this.width);
    this.registerPropertyEffect('--ddl-item-height', this.height);
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

import {
  ChangeDetectionStrategy,
  Component, effect,
  ElementRef, HostListener, Inject, output, Signal, signal,
} from '@angular/core';
import {GridComponent} from "../grid/grid.component";
import {Item, ItemDragEvent} from "./item.definitions";


@Component({
  selector: 'ddl-item',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item.component.html',
  styleUrl: './item.component.css',
})
export class ItemComponent {
  protected static itemIdCounter: number = 0;
  public id: string = `${ItemComponent.itemIdCounter++}`;

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
  public startDrag(event: PointerEvent) {
    this._dragging = true;
    this.dragStart.emit({
      item: this.getItem(),
      event: event,
    });
    event.preventDefault();
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

    // this.placeholder.destroyPlaceholder();
    this.dragEnd.emit({
      item: this.getItem(),
      event: event,
    });
    this._dragging = false;
    event.preventDefault();
  }

  public constructor(
    @Inject(ElementRef) private item: ElementRef<HTMLDivElement>,
  ) {
    this.registerPropertyEffect('--ddl-item-x', this.x);
    this.registerPropertyEffect('--ddl-item-y', this.y);
    this.registerPropertyEffect('--ddl-item-width', this.width);
    this.registerPropertyEffect('--ddl-item-height', this.height);
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

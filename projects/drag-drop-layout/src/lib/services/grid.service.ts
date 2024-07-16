import {HostListener, Injectable} from '@angular/core';
import {Item} from "../item/item.definitions";
import {ItemComponent} from "../item/item.component";

@Injectable({
  providedIn: 'root'
})
export class GridService {
  private currentlyDraggingItem: Item | null = null;
  private currentlyDraggingItemComponent: ItemComponent | null = null;

  private _dragging = false;
  private _resizing = false;

  @HostListener('document:pointermove', ['$event'])
  private dragResizeMove(event: PointerEvent) {
    if (!this._dragging && !this._resizing) {
      return;
    }

    if (this._dragging) {
      this.dragMove(event);
    } else {
      this.resizeMove(event);
    }
    event.preventDefault();
  }

  @HostListener('document:pointerup', ['$event'])
  private dragResizeStop(event: PointerEvent) {
    if (!this._dragging && !this._resizing) {
      return;
    }

    if (this._dragging) {
      this.dragEnd(event);
    } else {
      this.resizeEnd(event);
    }
    this._dragging = false;
    this._resizing = false;
    event.preventDefault();
  }

  constructor() { }

  public startDrag(item: Item, itemCom: ItemComponent): void {
    this._dragging = true;
    this.currentlyDraggingItem = item;
    this.currentlyDraggingItemComponent = itemCom;
  }

  public dragMove(event: PointerEvent): void {

  }

  public dragEnd(event: PointerEvent): void {
  }


  public startResize(item: Item, resizeType: string): void {
    this._resizing = true;
    this.currentlyDraggingItem = item;
  }

  public resizeMove(event: PointerEvent): void {

  }

  public resizeEnd(event: PointerEvent): void {
  }
}

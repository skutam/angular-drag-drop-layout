import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {GridComponent, ItemComponent, Item, itemTrackBy, DragHandleDirective, DragItemDirective, DragItemsDirective, ResizeType} from 'drag-drop-layout';
import {NgForOf} from "@angular/common";
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgForOf, FormsModule, GridComponent, ItemComponent, DragHandleDirective, DragItemDirective, DragItemsDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent {
  public columns = 12;
  public rows: number = 4;
  public colGap: number = 20;
  public rowGap: number = 20;

  public items: Item[] = [
    new Item('0', 6, 2, 2, 2),
    new Item('1', 2, 2, 2, 1),
    new Item('2', 11, 3, 1, 2),
  ];

  public resizeTypes: ResizeType[] = ['bottom-right', 'right', 'top-left', 'left', 'bottom-left', 'top', 'bottom', 'top-right'];
  public dragItems: string[] = ['Item 1', 'Item 2', 'Item 3'];

  public addItem(): void {
    if (this.items.length === 0) {
      this.items.push(new Item('0', 1, 1, 1, 1));
    } else {
      const lastItem = this.items[this.items.length - 1];
      const newItem = lastItem.clone();
      newItem.id = (parseInt(lastItem.id) + 1).toString();
      newItem.x = lastItem.x + 1;
      newItem.y = lastItem.y + 1;
      this.items.push(newItem);
    }
  }

  protected toggleResizeType(resizeType: ResizeType): void {
    if (this.resizeTypes.includes(resizeType)) {
      this.resizeTypes = this.resizeTypes.filter((type) => type !== resizeType);
    } else {
      this.resizeTypes.push(resizeType);
    }
  }

  protected readonly itemTrackBy = itemTrackBy;
  protected readonly RESIZE_TYPES: ResizeType[] = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'];
}

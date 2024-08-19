import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  itemTrackBy,
  ResizeType,
  DragDropLayoutModule,
  Item
} from '@skutam/drag-drop-layout';
import {NgForOf, NgIf} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {GridItemDroppedEvent} from "../../../drag-drop-layout/src/lib/grid/grid.definitions";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgForOf, FormsModule, DragDropLayoutModule, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent {
  public columns = 12;
  public rows: number = 4;
  public colGap: number = 20;
  public rowGap: number = 20;

  public showRemoveItemButton: boolean = true;

  public itemsTop: Item[] = [
    new Item('0', 6, 2, 2, 2, 'Item 0 | TOP'),
    new Item('1', 2, 2, 2, 1, 'Item 1 | TOP'),
    new Item('2', 11, 3, 1, 2, 'Item 2 | TOP'),
  ];

  public itemsBottom: Item[] = [
    new Item('3', 6, 2, 2, 2, 'Item 3 | BOTTOM'),
    new Item('4', 2, 2, 2, 1, 'Item 4 | BOTTOM'),
  ];

  public resizeTypes: ResizeType[] = ['bottom-right', 'right', 'top-left', 'left', 'bottom-left', 'top', 'bottom'];
  public dragItems: string[] = ['Item 1', 'Item 2', 'Item 3'];

  public addItemTop(): void {
    if (this.itemsTop.length === 0) {
      this.itemsTop.push(new Item('0', 1, 1, 1, 1));
    } else {
      const lastItem = this.itemsTop[this.itemsTop.length - 1];
      const newItem = lastItem.clone();
      newItem.id = (parseInt(lastItem.id) + 1).toString();
      newItem.x = lastItem.x + 1;
      newItem.y = lastItem.y + 1;
      this.itemsTop.push(newItem);
    }
  }

  public removeItemTop(id: string): void {
    this.itemsTop = this.itemsTop.filter((item) => item.id !== id);
  }

  public removeItemBottom(id: string): void {
    this.itemsBottom = this.itemsBottom.filter((item) => item.id !== id);
  }

  public itemDropped(event: GridItemDroppedEvent): void {
    console.log(event);
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

import {Component} from '@angular/core';
import {DragDropLayoutModule, Item, itemTrackBy, ResizeType} from '@skutam/drag-drop-layout';
import {NgForOf, NgIf} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {GridItemDroppedEvent} from "../../../drag-drop-layout/src/lib/grid/grid.definitions";
import {HeightProp, HeightUnit} from "../../../drag-drop-layout/src/lib/definitions";
import {HeightPickerComponent} from "./height-picker/height-picker.component";
import {HeightPropPickerComponent} from "./height-prop-picker/height-prop-picker.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgForOf, FormsModule, DragDropLayoutModule, NgIf, HeightPickerComponent, HeightPropPickerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent {
  public columns = 12;
  public rows: number = 4;
  public colGap: number = 20;
  public rowGap: number = 20;
  public gridHeight: HeightProp = 'auto';
  public itemMinHeight: HeightUnit | null = null;
  public itemMinHeightIsNull: boolean = true;

  public showRemoveItemButton: boolean = true;
  public isResizable: boolean = true;
  public isDraggable: boolean = true;
  public isDisabled: boolean = false;

  public itemsTop: Item[] = [
    new Item(null, 6, 2, 2, 2, 'Item 0 | TOP'),
    new Item(null, 2, 2, 2, 1, 'Item 1 | TOP'),
    new Item(null, 11, 3, 1, 2, 'Item 2 | TOP'),
  ];

  public itemsBottom: Item[] = [
    new Item(null, 6, 2, 2, 2, 'Item 3 | BOTTOM'),
    new Item(null, 2, 2, 2, 1, 'Item 4 | BOTTOM'),
  ];

  public resizeTypes: ResizeType[] = ['bottom-right', 'right', 'top-left', 'left', 'bottom-left', 'top', 'bottom'];
  public dragItems: string[] = ['Item 1', 'Item 2', 'Item 3'];

  public addItemTop(): void {
    if (this.itemsTop.length === 0) {
      this.itemsTop.push(new Item(null, 1, 1, 1, 1));
    } else {
      const lastItem = this.itemsTop[this.itemsTop.length - 1];
      const newItem = lastItem.clone();
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

  public updateMinHeight(height: boolean): void {
    this.itemMinHeight = height ? '50px' : null;
  }

  protected readonly itemTrackBy = itemTrackBy;
  protected readonly RESIZE_TYPES: ResizeType[] = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'];
}

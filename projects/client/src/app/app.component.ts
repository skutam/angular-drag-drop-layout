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
  /**
   * The number of columns in the grid.
   */
  public columns = 12;
  /**
   * The number of rows in the grid.
   */
  public rows: number = 4;
  /**
   * The width of the grid in pixels.
   */
  public colGap: HeightUnit = '20px';

  /**
   * The height of the grid in pixels.
   */
  public rowGap: HeightUnit = '20px';

  /**
   * The height of the grid.
   * Possible values:
   * - 'auto' - The grid will be as tall as its content.
   * - 'max-content' - The grid will be as tall as the maximum height of its content.
   * - 'min-content' - The grid will be as tall as the minimum height of its content.
   * - 'fit-content' - The grid will be as tall as the content that fits within the grid.
   * - 'stretch' - The grid will stretch to fill the height with its container.
   * - `${number}${Unit}` - The grid will be a fixed height.
   */
  public gridHeight: HeightProp = 'auto';
  /**
   * The minimum height of the items in the grid.
   * Possible values:
   * - null - The items will not have a minimum height.
   * - `${number}${Unit}` - The items will have a minimum height.
   */
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

import {Component} from '@angular/core';
import {
  createGridItem,
  DragDropLayoutModule,
  EmptyRowRemovedEvent,
  GridItem,
  HeightProp,
  HeightUnit,
  InsertionSizing,
  MoveDirection,
  PlacementCommittedEvent,
  PlacementRejectedEvent,
  ResizeType,
} from '@skutam/drag-drop-layout';
import {FormsModule} from '@angular/forms';
import {HeightPickerComponent} from './height-picker/height-picker.component';
import {HeightPropPickerComponent} from './height-prop-picker/height-prop-picker.component';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DragDropLayoutModule, HeightPickerComponent, HeightPropPickerComponent],
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
  public rowsTop: number = 4;
  public rowsBottom: number = 4;
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
  public insertionSizing: InsertionSizing = 'fit-width';
  public preferredWidth = 12;
  public minInsertionWidth = 3;
  public allowRowGrowth = true;
  public readonly directionOrders: {label: string; value: readonly MoveDirection[]}[] = [
    {label: 'Down, left, right, up', value: ['bottom', 'left', 'right', 'top']},
    {label: 'Up, left, right, down', value: ['top', 'left', 'right', 'bottom']},
    {label: 'Right, down, left, up', value: ['right', 'bottom', 'left', 'top']},
  ];
  public movePriority = this.directionOrders[0].value;
  public placementMessage = 'Drag a palette widget into either grid.';

  public setPreferredWidth(value: number): void {
    this.preferredWidth = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
    this.minInsertionWidth = Math.min(this.minInsertionWidth, this.preferredWidth);
  }

  public setMinimumWidth(value: number): void {
    this.minInsertionWidth = Number.isFinite(value) ? Math.max(1, Math.min(this.preferredWidth, Math.floor(value))) : 1;
  }

  public loadScenario(scenario: 'gap' | 'cascade' | 'full' | 'transfer' | 'empty-rows'): void {
    this.columns = scenario === 'cascade' ? 4 : 12;
    this.rowsTop = this.rowsBottom = scenario === 'full' ? 1 : 3;
    this.preferredWidth = scenario === 'cascade' ? 2 : 12;
    this.minInsertionWidth = scenario === 'cascade' ? 1 : 3;
    this.insertionSizing = scenario === 'cascade' ? 'fixed' : 'fit-width';
    this.allowRowGrowth = true;
    this.itemMinHeight = '100px';
    this.itemMinHeightIsNull = false;
    this.movePriority = scenario === 'cascade' ? this.directionOrders[1].value : this.directionOrders[0].value;
    this.itemsBottom = [];
    if (scenario === 'empty-rows') {
      this.rowsTop = 5;
      this.itemsTop = [
        createGridItem({x: 1, y: 1, width: 6, height: 1, data: 'Name'}),
        createGridItem({x: 1, y: 3, width: 12, height: 1, data: 'Address'}),
        createGridItem({x: 1, y: 5, width: 12, height: 1, data: 'Notes'}),
      ];
      this.placementMessage = 'Hover or focus an empty row to remove it. Fields below move up one row.';
    } else if (scenario === 'gap') {
      this.itemsTop = [createGridItem({x: 1, y: 1, width: 6, height: 1, data: 'Existing input'})];
      this.placementMessage = 'Drop a palette widget in the empty right half: it will fit six columns.';
    } else if (scenario === 'cascade') {
      this.itemsTop = [
        createGridItem({x: 1, y: 2, width: 1, height: 1, data: 'Blocker'}),
        createGridItem({x: 1, y: 1, width: 1, height: 1, data: 'Above'}),
        createGridItem({x: 1, y: 3, width: 4, height: 1, data: 'Lower row'}),
      ];
      this.placementMessage = 'Drop on the blocker at column 1, row 2: moving it right avoids an upward cascade.';
    } else if (scenario === 'full') {
      this.itemsTop = [createGridItem({x: 1, y: 1, width: 12, height: 1, data: 'Full row'})];
      this.placementMessage = 'Drop on the full row: one additional row makes room. Disable growth to see rejection.';
    } else {
      this.itemsTop = [createGridItem({x: 1, y: 1, width: 6, height: 1, data: 'Move me to the lower grid'})];
      this.itemsBottom = [createGridItem({x: 1, y: 1, width: 6, height: 1, data: 'Destination input'})];
      this.placementMessage = 'Move the existing widget into the lower grid: its six-column width is preserved.';
    }
  }

  public onCommitted(event: PlacementCommittedEvent): void {
    this.placementMessage = `${event.operation}: ${event.item.width} columns at (${event.item.x}, ${event.item.y}), ${event.rows} rows.`;
  }

  public onEmptyRowRemoved(event: EmptyRowRemovedEvent): void {
    this.placementMessage = `Removed empty row ${event.row} from ${event.gridId}; ${event.rows} rows remain.`;
  }

  public onRejected(event: PlacementRejectedEvent): void {
    this.placementMessage = `Placement rejected: ${event.reason}.`;
  }

  public itemsTop: readonly GridItem<string>[] = [
    createGridItem({x: 6, y: 2, width: 2, height: 2, data: 'Item 0 | TOP'}),
    createGridItem({x: 2, y: 2, width: 2, height: 1, data: 'Item 1 | TOP'}),
    createGridItem({x: 11, y: 3, width: 1, height: 2, data: 'Item 2 | TOP'}),
  ];

  public itemsBottom: readonly GridItem<string>[] = [
    createGridItem({x: 6, y: 2, width: 2, height: 2, data: 'Item 3 | BOTTOM'}),
    createGridItem({x: 2, y: 2, width: 2, height: 1, data: 'Item 4 | BOTTOM'}),
  ];

  public resizeTypes: ResizeType[] = ['bottom-right', 'right', 'top-left', 'left', 'bottom-left', 'top', 'bottom'];
  public dragItems: string[] = ['Item 1', 'Item 2', 'Item 3'];

  public addItemTop(): void {
    if (this.itemsTop.length === 0) {
      this.itemsTop = [...this.itemsTop, createGridItem({x: 1, y: 1, width: 1, height: 1})];
    } else {
      const lastItem = this.itemsTop[this.itemsTop.length - 1];
      const newItem = createGridItem({
        x: Math.min(this.columns - lastItem.width + 1, lastItem.x + 1),
        y: lastItem.y + 1,
        width: lastItem.width,
        height: lastItem.height,
        data: lastItem.data,
      });
      this.itemsTop = [...this.itemsTop, newItem];
    }
  }

  public removeItemTop(id: string): void {
    this.itemsTop = this.itemsTop.filter((item) => item.id !== id);
  }

  public removeItemBottom(id: string): void {
    this.itemsBottom = this.itemsBottom.filter((item) => item.id !== id);
  }

  protected toggleResizeType(resizeType: ResizeType): void {
    if (this.resizeTypes.includes(resizeType)) {
      this.resizeTypes = this.resizeTypes.filter((type) => type !== resizeType);
    } else {
      this.resizeTypes.push(resizeType);
    }
  }

  protected readonly RESIZE_TYPES: ResizeType[] = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'];
  protected readonly document = document;
}

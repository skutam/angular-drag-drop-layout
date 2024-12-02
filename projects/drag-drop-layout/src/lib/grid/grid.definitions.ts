import {GridComponent} from "./grid.component";
import {Item} from "../item/item.definitions";

export interface GridEvent {
  event: PointerEvent;
  item: Item;
  dragResizeData: IDragResizeData;
}

export interface GridItemDroppedEvent {
  event: PointerEvent;
  item: Item;
}

export interface GridRectData {
  top: number;
  left: number;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  colGap: number;
  rowGap: number;
}

export interface IDragResizeData {
  fromGrid: GridComponent | null;     // The grid the drag started from
  previousGrid: GridComponent | null; // The grid the item was previously in the last pointer move check
  currentGrid: GridComponent | null;  // The grid the item is currently in, used to trigger dragEnter and dragLeave events
  item: Item;                           // The item being dragged, used primarily for holding information about the item when dragging between grids
  dragItemElement: HTMLElement | null; // The element of new item we are trying to drag into grid
  dragging: boolean; // Differentiate between dragging and resizing
  dragOffset: { // The offset of the item from the top left corner of the grid to the pointer on drag start
    x: number;
    y: number;
  };
  itemOffset: {
    x: number;
    y: number;
  }
}

export interface IGridPointerEvent {
  event: PointerEvent;
  dragResizeData: IDragResizeData;
}

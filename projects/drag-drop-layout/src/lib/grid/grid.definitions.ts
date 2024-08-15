import {GridComponent} from "./grid.component";
import {Item} from "../item/item.definitions";
import {ItemComponent} from "../item/item.component";

export interface GridEvent {
  event: PointerEvent;
  item: Item;
  draggingItemRect: DOMRect;
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
}

export interface IDragResizeData {
  fromGrid: GridComponent | null;
  item: Item;
  itemComponent: ItemComponent | null;
  dragItemElement: HTMLElement | null;
  dragging: boolean; // Differentiate between dragging and resizing
  previousGrid: GridComponent | null; // The grid the item was previously in the last pinter move check
  currentGrid: GridComponent | null;  // The grid the item is currently in, used to trigger dragEnter and dragLeave events
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

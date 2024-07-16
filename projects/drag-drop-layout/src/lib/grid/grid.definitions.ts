import {GridComponent} from "./grid.component";
import {Item} from "../item/item.definitions";

export interface GridEvent {
  grid: GridComponent;
  event: PointerEvent;
  item: Item;
}

import { Injectable } from '@angular/core';
import {GridComponent} from "../grid/grid.component";
import {DragItemDirective} from "../directives/drag-item.directive";
import {BehaviorSubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class GridDragItemService {
  private grids = new Map<GridComponent, BehaviorSubject<DragItemDirective[]>>();

  public getGrids(): GridComponent[] {
    return Array.from(this.grids.keys());
  }

  /**
   * Register a grid with the service, needs to be called when the grid is constructed
   */
  public registerGrid(grid: GridComponent): void {
    if (this.grids.has(grid)) {
      throw new Error('Grid already registered');
    }
    this.grids.set(grid, new BehaviorSubject<DragItemDirective[]>([]));
  }

  public unregisterGrid(grid: GridComponent): void {
    if (!this.grids.has(grid)) {
      throw new Error('Grid not registered');
    }
    this.grids.delete(grid);
  }

  public registerItems(grid: GridComponent, items: DragItemDirective[]): void {
    if (!this.grids.has(grid)) {
      throw new Error('Grid not registered');
    }

    // Add the items to the grid items, ignore duplicates
    const gridItems = this.grids.get(grid)!.getValue();
    this.grids.get(grid)!.next([...gridItems, ...items.filter((item) => !gridItems.includes(item))]);
  }

  public unregisterItem(item: DragItemDirective): void {
    this.grids.forEach((items) => {
      items.next(items.getValue().filter((i) => i !== item));
    });
  }
}

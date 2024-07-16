import {
  AfterViewInit,
  ContentChildren,
  Directive,
  input,
  InputSignal,
  OnDestroy,
  QueryList
} from '@angular/core';
import {DragItemDirective} from "./drag-item.directive";
import {Subscription} from "rxjs";
import {GridComponent} from "../grid/grid.component";
import {GridDragItemService} from "../services/grid-drag-item.service";

@Directive({
  selector: '[ddlDragItems]',
  standalone: true
})
export class DragItemsDirective implements AfterViewInit, OnDestroy {
  @ContentChildren(DragItemDirective, {descendants: true}) private itemDirectives!: QueryList<DragItemDirective>;
  private itemSubscription: Subscription | null = null;

  // Inputs
  public grids: InputSignal<GridComponent[]> = input<GridComponent[]>([]);

  constructor(
    private gridDragItemService: GridDragItemService,
  ) {
  }

  public ngAfterViewInit(): void {
    this.itemSubscription = this.itemDirectives.changes.subscribe(() => {
      this.registerItems();
    });
    this.registerItems();
  }

  public ngOnDestroy(): void {
    if (this.itemSubscription) {
      this.itemSubscription.unsubscribe();
    }
  }

  private registerItems(): void {
    this.grids().forEach((grid) => {
      this.gridDragItemService.registerItems(grid, this.itemDirectives.toArray());
    });
  }
}

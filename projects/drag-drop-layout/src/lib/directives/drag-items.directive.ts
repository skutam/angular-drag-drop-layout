import {
  AfterViewInit,
  ContentChildren, DestroyRef,
  Directive,
  input,
  InputSignal,
  QueryList
} from '@angular/core';
import {DragItemDirective} from "./drag-item.directive";
import {GridComponent} from "../grid/grid.component";
import {GridDragItemService} from "../services/grid-drag-item.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Directive({
  selector: '[ddlDragItems]',
})
export class DragItemsDirective implements AfterViewInit {
  @ContentChildren(DragItemDirective, {descendants: true}) private itemDirectives!: QueryList<DragItemDirective>;

  // Inputs
  public grids: InputSignal<GridComponent[]> = input<GridComponent[]>([]);

  constructor(
    private gridDragItemService: GridDragItemService,
    private destroyRef: DestroyRef,
  ) { }

  public ngAfterViewInit(): void {
    this.itemDirectives.changes.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.registerItems();
    });
    this.registerItems();
  }

  private registerItems(): void {
    this.grids().forEach((grid) => {
      this.gridDragItemService.registerItems(grid, this.itemDirectives.toArray());
    });
  }
}

import {Component, ElementRef, Inject, Input, OnChanges} from '@angular/core';
import {ItemComponent} from "../item/item.component";
import {NgForOf} from "@angular/common";
import {Grid} from "./grid.definitions";
import {DimensionValue} from "../lib.definitions";

@Component({
  selector: 'ddl-grid',
  standalone: true,
  imports: [ItemComponent, NgForOf],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.css'
})
export class GridComponent implements Grid, OnChanges {
  private static itemIdCounter: number = 0;
  public id: number = GridComponent.itemIdCounter++;

  @Input() public columns: number = 12;
  @Input() public rows: number = 3;
  @Input() public colGap: DimensionValue = {value: 8, unit: 'px'};
  @Input() public rowGap: DimensionValue = {value: 8, unit: 'px'};

  constructor(
    @Inject(ElementRef) private grid: ElementRef<HTMLElement>,
  ) { }

  /**
   * TODO: Figure out how to calculate position of item in grid when dragging/resizing
   * TODO: Figure out how to keep data in sync between library and app
   * TODO: Figure out how to calculate move of items when dragging/resizing, so the items move out of the way
   */

  public ngOnChanges(): void {
    this.updateGrid();
  }

  private updateGrid(): void {
    this.grid.nativeElement.style.setProperty('--ddl-grid-columns', this.columns.toString());
    this.grid.nativeElement.style.setProperty('--ddl-grid-rows', this.rows.toString());
    this.grid.nativeElement.style.setProperty('--ddl-grid-col-gap', this.colGap.value + this.colGap.unit);
    this.grid.nativeElement.style.setProperty('--ddl-grid-row-gap', this.rowGap.value + this.rowGap.unit);
  }
}

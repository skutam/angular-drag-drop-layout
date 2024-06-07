import {ChangeDetectionStrategy, Component, effect, ElementRef, Inject, input, InputSignal} from '@angular/core';
import {ItemComponent} from "../item/item.component";
import {NgForOf} from "@angular/common";
import {DimensionValue} from "../lib.definitions";

@Component({
  selector: 'ddl-grid',
  standalone: true,
  imports: [ItemComponent, NgForOf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.css'
})
export class GridComponent {
  private static itemIdCounter: number = 0;
  public id: number = GridComponent.itemIdCounter++;

  public columns = input(12);
  public rows = input(3);
  public colGap: InputSignal<DimensionValue> = input(new DimensionValue(8, 'px'));
  public rowGap: InputSignal<DimensionValue> = input(new DimensionValue(8, 'px'));

  constructor(
    @Inject(ElementRef) private grid: ElementRef<HTMLElement>,
  ) {
    this.registerPropertyEffect('--ddl-grid-columns', this.columns);
    this.registerPropertyEffect('--ddl-grid-rows', this.rows);
    this.registerPropertyEffect('--ddl-grid-col-gap', this.colGap);
    this.registerPropertyEffect('--ddl-grid-row-gap', this.rowGap);
  }

  private registerPropertyEffect(property: string, signalValue: InputSignal<any>): void {
    effect(() => {
      this.grid.nativeElement.style.setProperty(property, signalValue().toString());
    });
  }

  /**
   * TODO: Figure out how to calculate position of item in grid when dragging/resizing
   * TODO: Figure out how to keep data in sync between library and app
   * TODO: Figure out how to calculate move of items when dragging/resizing, so the items move out of the way
   */
}

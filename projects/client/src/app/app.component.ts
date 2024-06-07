import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GridComponent, DimensionValue } from 'drag-drop-layout';
import {ItemComponent} from "../../../drag-drop-layout/src/lib/item/item.component";
import {NgForOf} from "@angular/common";
import {Item} from "../../../drag-drop-layout/src/lib/item/item.definitions";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GridComponent, ItemComponent, NgForOf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent {
  public colGap: DimensionValue = { value: 8, unit: 'px' };
  public rowGap: DimensionValue = { value: 8, unit: 'px' };
  public columns: number = 12;
  public rows: number = 3;

  public items: Item[] = [];

  public addItem(): void {
    if (this.items.length === 0) {
      this.items.push({
        x: 1,
        y: 1,
        width: 1,
        height: 1,
      });
    } else {
      const lastItem = this.items[this.items.length - 1];
      this.items.push({
        x: lastItem.x + 1,
        y: lastItem.y + 1,
        width: 1,
        height: 1,
      });
    }
  }
}

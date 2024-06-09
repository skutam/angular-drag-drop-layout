import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GridComponent, ItemComponent, Item, itemTrackBy } from 'drag-drop-layout';
import {NgForOf} from "@angular/common";
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgForOf, FormsModule, GridComponent, ItemComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less'
})
export class AppComponent {
  public columns = 12;
  public rows: number = 3;

  public items: Item[] = [
    new Item('0', 1, 1, 1, 1),
    new Item('1', 2, 2, 1, 1),
    new Item('2', 3, 3, 1, 1),
  ];

  public addItem(): void {
    if (this.items.length === 0) {
      this.items.push(new Item('0', 1, 1, 1, 1));
    } else {
      const lastItem = this.items[this.items.length - 1];
      const newItem = lastItem.clone();
      newItem.id = (parseInt(lastItem.id) + 1).toString();
      newItem.x = lastItem.x + 1;
      newItem.y = lastItem.y + 1;
      this.items.push(newItem);
    }
  }

  protected readonly itemTrackBy = itemTrackBy;
}

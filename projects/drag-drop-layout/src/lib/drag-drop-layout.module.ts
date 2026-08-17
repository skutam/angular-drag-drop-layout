import { NgModule } from '@angular/core';
import {GridComponent} from "./grid/grid.component";
import {ItemComponent} from "./item/item.component";
import {DragHandleDirective} from "./directives/drag-handle.directive";
import {DragItemDirective} from "./directives/drag-item.directive";
import {DragItemsDirective} from "./directives/drag-items.directive";
import {CommonModule} from "@angular/common";


@NgModule({
  imports: [
    CommonModule,
  ],
  declarations: [
    GridComponent,
    ItemComponent,
    DragHandleDirective,
    DragItemDirective,
    DragItemsDirective,
  ],
  exports: [
    GridComponent,
    ItemComponent,
    DragHandleDirective,
    DragItemDirective,
    DragItemsDirective,
  ],
})
export class DragDropLayoutModule { }

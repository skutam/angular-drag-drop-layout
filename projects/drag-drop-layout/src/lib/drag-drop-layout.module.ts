import { NgModule } from '@angular/core';
import {GridComponent} from "./grid/grid.component";
import {ItemComponent} from "./item/item.component";
import {DragHandleDirective} from "./directives/drag-handle.directive";
import {DragItemDirective} from "./directives/drag-item.directive";
import {DragItemsDirective} from "./directives/drag-items.directive";
import {GridService} from "./services/grid.service";
import {GridDragItemService} from "./services/grid-drag-item.service";
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
  providers: [
    GridService,
    GridDragItemService,
  ],
})
export class DragDropLayoutModule { }

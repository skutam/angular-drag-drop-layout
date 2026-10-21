import { NgModule } from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {EmptyRowDirective} from './directives/empty-row.directive';
import {GridComponent} from "./grid/grid.component";
import {ItemComponent} from "./item/item.component";
import {DragHandleDirective} from "./directives/drag-handle.directive";
import {DragItemDirective} from "./directives/drag-item.directive";
import {DragItemsDirective} from "./directives/drag-items.directive";


@NgModule({
  imports: [NgTemplateOutlet, EmptyRowDirective],
  declarations: [
    GridComponent,
    ItemComponent,
    DragHandleDirective,
    DragItemDirective,
    DragItemsDirective,
  ],
  exports: [
    EmptyRowDirective,
    GridComponent,
    ItemComponent,
    DragHandleDirective,
    DragItemDirective,
    DragItemsDirective,
  ],
})
export class DragDropLayoutModule { }

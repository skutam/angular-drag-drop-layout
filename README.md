# Angular drag drop layout

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.1.14. 

## Features

- No dependencies
- Optimized
- Angular 18
- Angular signals
- Responsive css grid layout
- Draggable items
- Drag drop into and between grids
- Custom drag handles

## Installation

```bash
npm install angular-drag-drop-layout
```

## Usage

1. Import the `DragDropLayoutModule` in your module.

```typescript
import { DragDropLayoutModule } from '@skutam/drag-drop-layout';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    DragDropLayoutModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})

export class AppModule { }
```

2. Use the `ddl-grid` and `ddl-item` components in your template.

```html

<div class="drag-items" ddlDragItems [grids]="[grid]">
  <div ddlDragItem
       class="drag-item"
       [draggable]="true"
       [disabled]="i == 1"
       [width]="2"
       [height]="2"
       [dragData]="i"
       *ngFor="let dragItem of dragItems; let i = index">{{dragItem}}</div>
</div>

<ddl-grid [columns]="columns" #grid class="grid"
          [rows]="rows"
          [colGap]="colGap"
          [rowGap]="rowGap"
          (itemDropped)="itemDropped($event)"
          [(items)]="items">
  <ddl-item *ngFor="let item of items; trackBy: itemTrackBy" [resizeTypes]="resizeTypes">
    <div class="item-info">{{item.id}} [{{item.x}},{{item.y}}] ({{item.width}},{{item.height}})</div>
    <span class="item-info-data">{{item.data}}</span>
    <div ddlDragHandle class="drag-handle">Handle</div>
  </ddl-item>
</ddl-grid>
```

3. Define the grid and items in your component.

```typescript
import { Component } from '@angular/core';
import { Item, ResizeType, GridItemDroppedEvent } from '@skutam/drag-drop-layout';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public columns = 12;
  public rows: number = 4;
  public colGap: number = 20;
  public rowGap: number = 20;

  public items: Item[] = [
    new Item('0', 6, 2, 2, 2, 'Item 0 | TOP'),
    new Item('1', 2, 2, 2, 1, 'Item 1 | TOP'),
    new Item('2', 11, 3, 1, 2, 'Item 2 | TOP'),
  ];

  public resizeTypes: ResizeType[] = ['bottom-right', 'right', 'top-left', 'left', 'bottom-left', 'top', 'bottom', 'top-right'];
  public dragItems: string[] = ['Item 1', 'Item 2', 'Item 3'];

  public itemDropped(event: GridItemDroppedEvent): void {
    console.log(event);
  }

  protected readonly itemTrackBy = itemTrackBy;
  protected readonly RESIZE_TYPES: ResizeType[] = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'];
}
```

## Development

1. Clone the repository

```bash
git clone git@github.com:skutam/angular-drag-drop-layout.git
cd angular-drag-drop-layout
```

2. Install the dependencies

```bash
npm install
```

3. Start the watch mode for the library

```bash
npm run watch:lib
```

4. Serve the demo application

```bash
npm run serve:client
```

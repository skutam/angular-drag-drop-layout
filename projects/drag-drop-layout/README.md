# Angular Drag Drop Layout

[![npm](https://img.shields.io/npm/v/%40skutam%2Fdrag-drop-layout)](https://www.npmjs.com/package/@skutam/drag-drop-layout)
[![license](https://img.shields.io/github/license/skutam/angular-drag-drop-layout)](LICENSE)

A signal-based Angular 18 CSS-grid library for transactional dragging, resizing, collision reflow, palette insertion, and explicit cross-grid transfers.

[View the demo](https://skutam.github.io/angular-drag-drop-layout/)

## Features

- Collision reflow that minimizes displaced widgets and total movement, with configurable direction tie-breaking.
- New palette widgets fit the horizontal gap under the pointer, subject to a minimum insertion width.
- Atomic live previews: successful drops commit once; rejected interactions restore the complete starting layout.
- Optional minimum row growth with no automatic row removal.
- Dragging and resizing on every edge and corner.
- Explicit, ID-based connections between multiple grids.
- Palette items that can be reused after successful or rejected drops.
- Scroll-aware placeholders and stable auto-height row geometry.
- Immutable item records and Angular signal model bindings.
- No third-party drag-and-drop dependency.

## Installation

```bash
npm install @skutam/drag-drop-layout
```

The v2 package supports Angular 18 and Node `^18.19.1 || ^20.11.1 || >=22`.

## Basic usage

```typescript
import {Component} from '@angular/core';
import {
  createGridItem,
  DragDropLayoutModule,
  GridItem,
  MoveDirection,
  PlacementCommittedEvent,
  PlacementRejectedEvent,
  ResizeType,
} from '@skutam/drag-drop-layout';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DragDropLayoutModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  public rows = 4;
  public items: readonly GridItem<string>[] = [
    createGridItem({x: 1, y: 1, width: 2, height: 1, data: 'Orders'}),
    createGridItem({x: 3, y: 1, width: 2, height: 2, data: 'Revenue'}),
  ];
  public readonly movePriority: readonly MoveDirection[] = ['bottom', 'left', 'right', 'top'];
  public readonly resizeTypes: ResizeType[] = ['right', 'bottom', 'bottom-right'];

  public committed(event: PlacementCommittedEvent): void {
    console.info('Committed', event.operation, event.item.id);
  }

  public rejected(event: PlacementRejectedEvent): void {
    console.warn('Rejected', event.operation, event.reason);
  }
}
```

```html
<ddl-grid
  gridId="dashboard"
  [columns]="12"
  [(rows)]="rows"
  [(items)]="items"
  [movePriority]="movePriority"
  [allowRowGrowth]="true"
  (placementCommitted)="committed($event)"
  (placementRejected)="rejected($event)">
  @for (item of items; track item.id) {
    <ddl-item [itemId]="item.id" [resizeTypes]="resizeTypes">
      <div>{{ item.data }}</div>
      <div ddlDragHandle>Move</div>
    </ddl-item>
  }
</ddl-grid>
```

Coordinates are one-based. Every `GridItem` needs a unique, stable ID, and every projected `ddl-item` must bind that ID through `[itemId]`. The library owns successful layout changes: `itemsChange` and `rowsChange` are emitted by the two-way model bindings before `placementCommitted` fires.

## Collision reflow and row growth

The active proposal stays fixed while blockers are displaced. Palette insertion chooses its initial width before collision resolution; moves, transfers, resizes, and normalization retain their proposed dimensions. The solver compares complete cascades against the original snapshot: fewer displaced items first, then less total Manhattan distance, then direction traversal order. The active item is excluded from the score. Intentional gaps remain; there is no automatic compaction or swapping.

`movePriority` must be a non-empty, duplicate-free subset of:

- `top`
- `left`
- `right`
- `bottom`

The default is `['bottom', 'left', 'right', 'top']`. Omitted directions are prohibited. The array controls traversal and breaks equal-score ties; the first successful direction does not automatically win.

`allowRowGrowth` defaults to `true`. The solver first searches within existing rows. If it finds no solution, it may search with growth when `bottom` is permitted. Growth candidates are ranked by additional rows first, then displaced count and distance. An active proposal below the existing grid already requires growth. The solver never moves the active proposal elsewhere to avoid growth.

Each stage has a deterministic budget of 4,096 candidate expansions. The best complete result found is returned, even when the budget is reached. A truncated existing-row search without a result may fall back to growth. Rejection reports `search-limit` if exploration was truncated, or `no-space` if all directional candidates were exhausted. This bounded directional search does not guarantee a globally optimal arrangement.

When row growth is permitted, dragging near the original bottom edge offers one append position after the last row. This edge uses the bottom quarter of the last row, capped at 16 pixels. Move, transfer, and palette insertion previews keep that append position fixed for the entire drag, so temporary growth cannot create further drop positions. Each completed drop allows the next drag to append again. The item span and collision reflow can still grow the grid, and explicit resizing can extend past its original rows.

Committed rows are never removed automatically; applications can explicitly request fewer rows. During dragging, rendered rows may remain expanded to stabilize hover geometry. A drop commits only the rows required by the final layout, at least the original committed count; cancellation restores the original count.

Programmatic `items` changes use the same solver. Items are normalized in array order, so a later item keeps its requested position and displaces earlier items. Invalid updates preserve the last valid layout and emit `placementRejected`; an invalid initial item layout falls back to an empty grid.

Column changes are validated even when items and rows are unchanged. If the proposed layout does not fit the new columns, the grid restores its previous columns, rows, and items and emits `placementRejected` with operation `normalize`. It does not automatically reposition or resize items to fit a narrower grid. Use `[(columns)]="columns"` to receive the restored count in your application; `[columns]` remains supported, but its parent value is not updated automatically.

External changes to `items`, `rows`, or `columns` during an interaction involving that grid first cancel the interaction, then normalize the incoming layout. This includes updates to either grid involved in a transfer. Subsequent events from the cancelled pointer cannot overwrite the accepted update. Equivalent replacement arrays, the library's own commits, and updates to grids outside the interaction do not cancel it.

The `items` model is immutable. Every addition, removal, reorder, or item update must provide a new array reference; in-place mutations such as `push`, `splice`, or assigning an array index are not supported. Replace the affected `GridItem` record when changing coordinates, spans, IDs, or data.

## Multiple grids

Connections use stable grid IDs, never component references:

```html
<ddl-grid
  gridId="grid-a"
  [connectedTo]="['grid-b']"
  [(items)]="itemsA"
  [(rows)]="rowsA">
  <!-- items A -->
</ddl-grid>

<ddl-grid
  gridId="grid-b"
  [connectedTo]="['grid-a']"
  [(items)]="itemsB"
  [(rows)]="rowsB">
  <!-- items B -->
</ddl-grid>
```

A grid is always connected to itself. Cross-grid transfers commit the destination model first, then the source model, and emit one `placementCommitted` event after both updates. Dropping outside every allowed grid restores an existing item to its source. Duplicate grid IDs throw a configuration error.

Keep separate row models for separate grids. Preview growth is local to the grid being interacted with.

## Palette items

Declare the allowed target IDs on `ddlDragItems`:

```html
<div ddlDragItems [targets]="['grid-a', 'grid-b']">
  <button
    ddlDragItem
    [width]="12"
    [height]="1"
    insertionSizing="fit-width"
    [minInsertionWidth]="3"
    [dragData]="{kind: 'input'}">
    Add input
  </button>
</div>
```

A palette candidate exists only inside the interaction transaction. A successful drop is added to the target `items` model. A rejected candidate is discarded, and its source element remains reusable.

`InsertionSizing` is the exported union `'fit-width' | 'fixed'`. The `ddlDragItem` inputs are:

| Input | Default | Meaning |
| --- | --- | --- |
| `width` | `1` | Preferred insertion width in columns |
| `height` | `1` | Insertion height in rows; fitting never changes it |
| `insertionSizing` | `'fit-width'` | Fit the local gap, or preserve configured dimensions with `'fixed'` |
| `minInsertionWidth` | `1` | Minimum width during initial fitting only |

Fitting finds the contiguous horizontal gap under the pointer that is clear across the entire widget height. It uses the largest width up to preferred width and target columns, at the leftmost fitting location containing the pointed column. A full-width widget hovering anywhere inside an empty half-row previews at half width. It never searches other rows or unrelated gaps.

If the pointer is over occupied space or the gap is below the insertion minimum, normal pushing uses preferred width capped to grid columns. A destination narrower than the minimum is rejected. Fixed insertion never shrinks, and a fixed widget wider than the destination is rejected. Dimensions and the minimum must be positive integers, with the minimum no greater than preferred width.

Every preview starts from the original preferred dimensions, so entering a wider gap restores the wider preview. The committed item and event contain the actual fitted dimensions. Existing widgets keep their size when moved or transferred. Insertion options are session settings, not persisted item fields.

## Events

On pointer release, the library commits the models or restores the layout, clears the interaction and placeholder, emits `dragEnd` or `resizeEnd`, then emits the placement result. Completion handlers can synchronously start another interaction without cleanup or end notifications from the previous interaction ending it. Transfers update both grid models before completion handlers run.

`placementCommitted` contains the operation, committed item, source and target grid IDs, committed items, and row count.

`placementRejected` contains the operation, rejection reason, attempted item, and source and target grid IDs. Reasons are `invalid-config`, `invalid-item`, `duplicate-item-id`, `out-of-bounds`, `no-space`, `search-limit`, `not-connected`, `cancelled`, or `outside-grid`.

Pointer cancellation, a superseding interaction, or an external item or dimension change affecting an interaction clears its previews and reports `cancelled`. Cancellation never commits a placement. For external changes, the incoming layout is validated after cancellation; invalid updates preserve the last valid layout and also emit a normalization rejection. Drag/resize end notifications still fire so consumers can clean up; a cancelled palette candidate that has not entered a grid has no grid on which to emit `placementRejected`.

Model outputs are commit-only. Live preview never emits `itemsChange` or `rowsChange`.

## Sizing and scrolling

Use `gridHeight`, `itemMinHeight`, `colGap`, `rowGap`, and `scrollableElement` to match the surrounding layout. During any resize with a vertical component—including corner resizing—the grid freezes its captured row geometry and extrapolates new bottom rows from it. Horizontal-only resizing releases that lock so wrapped content can contract and auto-height rows can shrink naturally.

Set `scrollableElement` to the scrolling element or `document` when the page scrolls during an interaction.

## Development

```bash
npm ci
npm run test:lib
npm run build
```

Run `node scripts/benchmark-layout.cjs` in the repository to measure dense-grid insertion with 12, 48, and 120 widgets. The demo includes Half-row gap, Minimal movement, Full grid, and Transfer presets.

Use `npm run watch:lib` with `npm run serve:client` for interactive development. See [the architecture guide](docs/architecture.md) for the library's internal structure.

import {Component, ViewChild} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {describe, expect, it, vi} from 'vitest';
import {DragDropLayoutModule} from '../drag-drop-layout.module';
import {GridItem} from '../item/item.definitions';
import {GridService} from '../services/grid.service';
import {GridComponent} from './grid.component';

@Component({
  imports: [DragDropLayoutModule],
  template: `
    <ddl-grid #grid gridId="rows" [columns]="4" [(items)]="items" [(rows)]="rows" [itemMinHeight]="'40px'">
      @for (item of items; track item.id) {
        <ddl-item [itemId]="item.id">{{item.id}}</ddl-item>
      }
      @if (controls) {
        <ng-template ddlEmptyRow let-row let-remove="remove" let-canRemove="canRemove">
          <button [disabled]="!canRemove" (click)="remove()">Remove {{row}}</button>
        </ng-template>
      }
    </ddl-grid>
    <ddl-grid #other gridId="other" [rows]="2" />
  `,
})
class Host {
  @ViewChild('grid') grid!: GridComponent;
  @ViewChild('other') other!: GridComponent;
  rows = 5;
  controls = true;
  items: readonly GridItem[] = [
    {id: 'first', x: 1, y: 1, width: 2, height: 1},
    {id: 'last', x: 1, y: 4, width: 4, height: 1},
  ];
}

async function setup(controls = true) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.controls = controls;
  fixture.detectChanges();
  await fixture.whenStable();
  return {fixture, host: fixture.componentInstance, grid: fixture.componentInstance.grid};
}

describe('empty-row grid API and template', () => {
  it('rejects removal before the initial layout is accepted', () => {
    const fixture = TestBed.createComponent(GridComponent);
    fixture.componentRef.setInput('gridId', 'uninitialized');
    expect(fixture.componentInstance.emptyRows()).toEqual([]);
    expect(fixture.componentInstance.removeEmptyRow(1)).toBe(false);
  });

  it('publishes source transfer changes only when committed, not while previewing', async () => {
    const {grid} = await setup(false);
    grid.previewSourceRemoval('first', grid.snapshot());
    expect(grid.emptyRows()).toEqual([2, 3, 5]);
    grid.clearPreview();
    expect(grid.emptyRows()).toEqual([2, 3, 5]);
    grid.commitSourceRemoval('first');
    expect(grid.emptyRows()).toEqual([1, 2, 3, 5]);
  });

  it('commits both models before its event and rejects reentrant removal during model notifications', async () => {
    const {host, grid} = await setup(false);
    const order: string[] = [];
    grid.items.subscribe(() => {
      order.push('items');
      expect(grid.removeEmptyRow(2)).toBe(false);
    });
    grid.rows.subscribe(() => order.push('rows'));
    grid.emptyRowRemoved.subscribe(event => {
      order.push('removed');
      expect(event).toEqual({gridId: 'rows', row: 2, rows: 4, items: host.items});
      expect(host.rows).toBe(4);
      expect(grid.snapshot().rows).toBe(4);
      expect(grid.emptyRows()).toEqual([2, 4]);
    });
    expect(grid.grid.nativeElement.querySelector('.ddl-empty-row')).toBeNull();
    expect(grid.removeEmptyRow(2)).toBe(true);
    expect(order).toEqual(['items', 'rows', 'removed']);
    expect(host.items.map(item => item.y)).toEqual([1, 3]);
  });

  it('renders typed controls, updates them after removal and disables the final row', async () => {
    const {fixture, host, grid} = await setup();
    expect(grid.emptyRows()).toEqual([2, 3, 5]);
    const button = grid.grid.nativeElement.querySelector('button')!;
    expect(button.textContent).toBe('Remove 2');
    button.click();
    fixture.detectChanges();
    expect(host.rows).toBe(4);
    expect(grid.grid.nativeElement.querySelectorAll('.ddl-empty-row')).toHaveLength(2);
    host.items = [];
    host.rows = 1;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(grid.emptyRows()).toEqual([1]);
    expect(grid.grid.nativeElement.querySelector('button')!.disabled).toBe(true);
    expect(grid.removeEmptyRow(1)).toBe(false);
  });

  it('rejects occupied, invalid and pending external state without emitting changes', async () => {
    const {grid, fixture} = await setup();
    const changed = vi.fn();
    grid.emptyRowRemoved.subscribe(changed);
    grid.items.subscribe(changed);
    grid.rows.subscribe(changed);
    for (const row of [0, 1, 4, 6, 1.5, NaN]) expect(grid.removeEmptyRow(row)).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    grid.items.set([{id: 'span', x: 1, y: 1, width: 1, height: 3}]);
    changed.mockClear();
    expect(grid.removeEmptyRow(2)).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(grid.emptyRows()).toEqual([4, 5]);
  });

  for (const operation of ['move', 'resize', 'insert'] as const) {
    it(`blocks all grids during ${operation} and restores controls after cancellation`, async () => {
      const {fixture, host, grid} = await setup();
      const service = TestBed.inject(GridService);
      const pointer = new PointerEvent('pointerdown', {pointerId: 71, button: 0});
      const element = grid.grid.nativeElement.querySelector<HTMLElement>('ddl-item')!;
      if (operation === 'move') service.startGridDrag(grid, host.items[0], element, pointer, {x: 0, y: 0}, null);
      if (operation === 'resize') service.startResize(grid, host.items[0], element, pointer, 'bottom', null);
      if (operation === 'insert') service.startPaletteDrag({...host.items[0], id: 'new'}, element, pointer, ['rows'], null);
      fixture.detectChanges();
      expect(grid.emptyRows()).toEqual([2, 3, 5]);
      expect(grid.removeEmptyRow(2)).toBe(false);
      expect(host.other.removeEmptyRow(1)).toBe(false);
      expect(grid.grid.nativeElement.querySelector<HTMLElement>('.ddl-empty-row')!.inert).toBe(true);
      document.dispatchEvent(new PointerEvent('pointercancel', {pointerId: 71}));
      fixture.detectChanges();
      expect(grid.canRemoveEmptyRow(2)).toBe(true);
      expect(host.other.canRemoveEmptyRow(1)).toBe(true);
      expect(grid.grid.nativeElement.querySelector<HTMLElement>('.ddl-empty-row')!.inert).toBe(false);
    });
  }

  it('does not change geometry when controls are toggled, including variable row heights', async () => {
    const {fixture, host, grid} = await setup(false);
    const element = grid.grid.nativeElement;
    element.style.gridTemplateRows = '40px 60px 80px 100px 120px';
    const before = element.getBoundingClientRect();
    const tracks = getComputedStyle(element).gridTemplateRows;
    host.controls = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const after = element.getBoundingClientRect();
    expect(after.height).toBe(before.height);
    expect(getComputedStyle(element).gridTemplateRows).toBe(tracks);
    const wrappers = element.querySelectorAll<HTMLElement>('.ddl-empty-row');
    expect(wrappers[0].getBoundingClientRect().top - after.top).toBe(48);
    expect(wrappers[0].getBoundingClientRect().height).toBe(60);
    expect(wrappers[1].getBoundingClientRect().height).toBe(80);
    expect(wrappers[2].getBoundingClientRect().height).toBe(120);
  });
});

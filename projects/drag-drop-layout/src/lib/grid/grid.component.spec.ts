import {CommonModule} from '@angular/common';
import {Component, ViewChild} from '@angular/core';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {DragDropLayoutModule} from '../drag-drop-layout.module';
import {GridGeometrySnapshot} from '../geometry/grid-geometry';
import {InteractionSession} from '../interaction/interaction.definitions';
import {GridItem, ResizeType} from '../item/item.definitions';
import {GridComponent} from './grid.component';

@Component({
  standalone: true,
  imports: [CommonModule, DragDropLayoutModule],
  template: `
    <ddl-grid gridId="grid-a" [connectedTo]="['grid-b']" [columns]="columns"
              [(rows)]="rowsA" [(items)]="itemsA" [itemMinHeight]="'20px'">
      <ddl-item *ngFor="let item of itemsA" [itemId]="item.id"></ddl-item>
    </ddl-grid>
    <ddl-grid #gridB gridId="grid-b" [connectedTo]="['grid-a']" [columns]="columns"
              [(rows)]="rowsB" [(items)]="itemsB">
      <ddl-item *ngFor="let item of itemsB" [itemId]="item.id"></ddl-item>
    </ddl-grid>
  `,
})
class HostComponent {
  @ViewChild(GridComponent) gridA!: GridComponent;
  @ViewChild('gridB') gridB!: GridComponent;
  public columns = 2;
  public rowsA = 2;
  public rowsB = 2;
  public itemsA: readonly GridItem[] = [];
  public itemsB: readonly GridItem[] = [];
}

describe('GridComponent', () => {
  const item = (id: string, x: number, y: number, width = 1, height = 1): GridItem =>
    Object.freeze({id, x, y, width, height});
  const geometry: GridGeometrySnapshot = {
    viewportLeft: 0,
    viewportTop: 0,
    width: 210,
    columnWidth: 100,
    columnGap: 10,
    rowGap: 10,
    rowHeights: [50, 50],
    fallbackRowHeight: 50,
    scroll: {x: 0, y: 0},
  };

  beforeEach(() => TestBed.configureTestingModule({imports: [HostComponent]}));

  it('normalizes programmatic collisions and keeps the later item fixed', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('first', 1, 1), item('later', 1, 1)];
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(fixture.componentInstance.itemsA.find((entry) => entry.id === 'later')).toEqual(item('later', 1, 1));
    expect(fixture.componentInstance.itemsA.find((entry) => entry.id === 'first')?.x).toBe(2);
  }));

  it('keeps a later programmatic item fixed and grows rows for the displaced blocker', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.itemsA = [item('blocker', 1, 1, 1, 2), item('new', 1, 2)];
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(fixture.componentInstance.rowsA).toBe(4);
    expect(fixture.componentInstance.itemsA.find((entry) => entry.id === 'new')?.y)
      .withContext(JSON.stringify(fixture.componentInstance.itemsA))
      .toBe(2);
    expect(fixture.componentInstance.itemsA.find((entry) => entry.id === 'blocker')?.y).toBe(3);
  }));

  it('adds a fresh-array item between items that were present during initialization', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.rowsA = 4;
    fixture.componentInstance.itemsA = [
      item('a', 1, 1),
      item('b', 1, 2),
      item('c', 1, 3),
      item('d', 1, 4),
    ];
    fixture.detectChanges();
    tick();

    fixture.componentInstance.itemsA = [...fixture.componentInstance.itemsA, item('new', 1, 2)];
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.rowsA).toBe(5);
    expect(fixture.componentInstance.itemsA.map((entry) => `${entry.id}:${entry.y}`))
      .toEqual(['a:1', 'b:3', 'c:4', 'd:5', 'new:2']);
  }));

  it('lets an immutably added item move through original blockers', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.rowsA = 5;
    fixture.componentInstance.itemsA = [item('a', 1, 1, 1, 2), item('b', 1, 3, 1, 2)];
    fixture.detectChanges();
    tick();

    fixture.componentInstance.itemsA = [...fixture.componentInstance.itemsA, item('new', 1, 5)];
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    expect(snapshot.items.map((entry) => entry.id)).toEqual(['a', 'b', 'new']);

    const session = makeSession('move', item('new', 1, 5), grid.interactionGridId, snapshot);
    session.geometries.set(grid.interactionGridId, {
      ...geometry,
      rowHeights: [50, 50, 50, 50, 50],
    });
    const preview = grid.preview(session, snapshot, {x: 20, y: 70}, {x: 0, y: 0});
    expect(preview.result.ok).toBeTrue();
    if (!preview.result.ok) return;
    expect(preview.result.rows).toBe(6);
    expect(preview.result.items.find((entry) => entry.id === 'new')?.y).toBe(2);
  }));

  it('accepts an immutable item removal', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('remove', 1, 1), item('keep', 2, 1)];
    fixture.detectChanges();
    tick();

    fixture.componentInstance.itemsA = fixture.componentInstance.itemsA
      .filter((entry) => entry.id !== 'remove');
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.gridA.snapshot().items).toEqual([item('keep', 2, 1)]);
  }));

  it('accepts an immutable item replacement in a new array', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('replace', 1, 1)];
    fixture.detectChanges();
    tick();

    fixture.componentInstance.itemsA = fixture.componentInstance.itemsA
      .map((entry) => entry.id === 'replace' ? item('replace', 2, 2) : entry);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.componentInstance.gridA.snapshot().items).toEqual([item('replace', 2, 2)]);
  }));

  it('preserves the last valid layout when a requested row reduction cannot fit', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.rowsA = 3;
    fixture.componentInstance.itemsA = [item('tall', 1, 1, 1, 3)];
    fixture.detectChanges();
    tick();
    fixture.componentInstance.rowsA = 2;
    fixture.detectChanges();
    tick();
    expect(fixture.componentInstance.rowsA).toBe(3);
    expect(fixture.componentInstance.itemsA).toEqual([item('tall', 1, 1, 1, 3)]);
  }));

  it('latches grown preview rows for the duration of an interaction', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.itemsA = [item('blocker', 1, 1, 1, 2)];
    fixture.detectChanges();
    tick();
    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    const session = makeSession('insert', item('new', 1, 1), grid.interactionGridId, snapshot);
    session.geometries.set(grid.interactionGridId, geometry);
    const grown = grid.preview(session, snapshot, {x: 20, y: 120}, {x: 0, y: 0});
    const backInside = grid.preview(session, snapshot, {x: 20, y: 20}, {x: 0, y: 0});
    expect(grown.result.ok).toBeTrue();
    expect(grid.renderedRows()).toBeGreaterThan(2);
    expect(backInside.result.ok).toBeTrue();
    expect(grid.renderedRows()).toBeGreaterThan(2);
  }));

  it('locks auto-row height for corner resize and releases it for horizontal-only resize', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('active', 1, 1)];
    fixture.detectChanges();
    tick();
    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    const corner = makeSession('resize', item('active', 1, 1), grid.interactionGridId, snapshot, 'bottom-right');
    corner.geometries.set(grid.interactionGridId, geometry);
    grid.preview(corner, snapshot, {x: 190, y: 140}, {x: 0, y: 0});
    expect(grid.interactionMinHeight()).not.toBeNull();
    grid.clearPreview(snapshot);
    const horizontal = makeSession('resize', item('active', 1, 1), grid.interactionGridId, snapshot, 'right');
    horizontal.geometries.set(grid.interactionGridId, geometry);
    grid.preview(horizontal, snapshot, {x: 190, y: 20}, {x: 0, y: 0});
    expect(grid.interactionMinHeight()).toBeNull();
  }));

  it('keeps preview row state local to the interacted grid', fakeAsync(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('a', 1, 1)];
    fixture.componentInstance.itemsB = [item('b', 1, 1)];
    fixture.detectChanges();
    tick();
    const gridB = fixture.componentInstance.gridB;
    const snapshot = gridB.snapshot();
    const session = makeSession('resize', item('b', 1, 1), 'grid-b', snapshot, 'bottom');
    session.geometries.set('grid-b', geometry);
    gridB.preview(session, snapshot, {x: 20, y: 200}, {x: 0, y: 0});
    expect(gridB.renderedRows()).toBeGreaterThan(2);
    expect(fixture.componentInstance.gridA.renderedRows()).toBe(2);
  }));
});

function makeSession(
  operation: 'insert' | 'move' | 'resize',
  active: GridItem,
  gridId: string,
  snapshot: ReturnType<GridComponent['snapshot']>,
  resizeType?: ResizeType,
): InteractionSession {
  return {
    pointerId: 1,
    operation,
    sourceGridId: operation === 'insert' ? null : gridId,
    item: active,
    itemOffset: {x: 0, y: 0},
    allowedTargets: new Set([gridId]),
    sourceSnapshot: operation === 'insert' ? null : snapshot,
    resizeType,
    geometries: new Map(),
    snapshots: new Map([[gridId, snapshot]]),
    targetGridId: gridId,
    lastResult: null,
  };
}

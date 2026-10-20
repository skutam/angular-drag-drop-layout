import {describe, it, expect, beforeEach, vi} from 'vitest';
import {Component, ViewChild} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {DragDropLayoutModule} from '../drag-drop-layout.module';
import {GridGeometrySnapshot} from '../geometry/grid-geometry';
import {InteractionSession} from '../interaction/interaction.definitions';
import {GridItem, ResizeType} from '../item/item.definitions';
import {LayoutEngine} from '../layout/layout-engine';
import {DEFAULT_MOVE_PRIORITY, MoveDirection} from '../layout/layout.definitions';
import {GridService} from '../services/grid.service';
import {GridComponent} from './grid.component';

@Component({
  imports: [DragDropLayoutModule],
  template: `
    @if (showGridA) {
      <ddl-grid #gridA [gridId]="gridIdA" [connectedTo]="['grid-b']" [(columns)]="columns"
        [(rows)]="rowsA" [(items)]="itemsA" [itemMinHeight]="'20px'"
        [allowRowGrowth]="allowRowGrowth" [movePriority]="movePriority">
        @for (item of itemsA; track item) {
          <ddl-item [itemId]="item.id"></ddl-item>
        }
      </ddl-grid>
    }
    <ddl-grid #gridB gridId="grid-b" [connectedTo]="['grid-a']" [columns]="columns"
      [(rows)]="rowsB" [(items)]="itemsB">
      @for (item of itemsB; track item) {
        <ddl-item [itemId]="item.id"></ddl-item>
      }
    </ddl-grid>
  `,
})
class HostComponent {
  @ViewChild('gridA') gridA!: GridComponent;
  @ViewChild('gridB') gridB!: GridComponent;
  public columns = 2;
  public showGridA = true;
  public gridIdA = 'grid-a';
  public rowsA = 2;
  public rowsB = 2;
  public itemsA: readonly GridItem[] = [];
  public itemsB: readonly GridItem[] = [];
  public allowRowGrowth = true;
  public movePriority: readonly MoveDirection[] = DEFAULT_MOVE_PRIORITY;
}

// Keep browser scheduling real; control only the timers used by pointer auditing and deferred outputs.
beforeEach(() => {
  vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'queueMicrotask']});
});

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

  it('preserves the grabbed column when moving a wide item away from the right edge', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.columns = 4;
    host.itemsA = [item('wide', 3, 1, 2)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = host.gridA;
    vi.spyOn(grid, 'captureGeometry').mockReturnValue({...geometry, width: 430});
    vi.spyOn(grid, 'containsPointer').mockReturnValue(true);
    const element = grid.grid.nativeElement.querySelector('ddl-item')!;
    element.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 41, clientX: 350, clientY: 20, button: 0, bubbles: true,
    }));
    document.dispatchEvent(new PointerEvent('pointerup', {pointerId: 41, clientX: 240, clientY: 20}));
    vi.advanceTimersByTime(0);
    expect(host.itemsA).toEqual([expect.objectContaining(item('wide', 2, 1, 2))]);
  });

  for (const change of ['remove', 'rename'] as const) {
    it(`cancels a transfer when its source grid is ${change === 'remove' ? 'removed' : 'renamed'}`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      const host = fixture.componentInstance;
      host.itemsA = [item('active', 1, 1)];
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      const source = host.gridA;
      const target = host.gridB;
      vi.spyOn(source, 'containsPointer').mockReturnValue(false);
      vi.spyOn(target, 'containsPointer').mockReturnValue(true);
      vi.spyOn(target, 'captureGeometry').mockReturnValue(geometry);
      const committed = vi.fn();
      target.placementCommitted.subscribe(committed);
      const service = TestBed.inject(GridService);
      const ended = vi.fn();
      service.pointerEnd$.subscribe(ended);
      service.startGridDrag(source, host.itemsA[0], source.grid.nativeElement,
        new PointerEvent('pointerdown', {pointerId: 42}), {x: 0, y: 0}, null);
      document.dispatchEvent(new PointerEvent('pointermove', {pointerId: 42, clientX: 20, clientY: 109}));
      vi.advanceTimersByTime(10);
      expect(target.renderedRows()).toBe(3);
      if (change === 'remove') host.showGridA = false;
      else host.gridIdA = 'renamed';
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      expect(ended).toHaveBeenCalledTimes(1);
      expect(target.renderedRows()).toBe(2);
      document.dispatchEvent(new PointerEvent('pointerup', {pointerId: 42, clientX: 20, clientY: 109}));
      vi.advanceTimersByTime(0);
      expect(committed).not.toHaveBeenCalled();
      expect(host.itemsB).toEqual([]);
    });
  }

  for (const height of [1, 2]) {
    it(`appends a ${height}-row palette item at the bottom without moving existing items or growing repeatedly`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      const host = fixture.componentInstance;
      const existing = item('existing', 1, 1, 2, 2);
      host.itemsA = [existing];
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const candidate = item('new', 1, 1, 2, height);
      TestBed.inject(GridService).startPaletteDrag(candidate, host.gridB.grid.nativeElement,
        new PointerEvent('pointerdown', {pointerId: 32}), ['grid-a'], null);
      for (let index = 0; index < 6; index++) {
        const rect = host.gridA.grid.nativeElement.getBoundingClientRect();
        document.dispatchEvent(new PointerEvent('pointermove', {
          pointerId: 32, clientX: rect.left + 1, clientY: rect.bottom - 1,
        }));
        vi.advanceTimersByTime(10);
        fixture.changeDetectorRef.markForCheck();
        fixture.detectChanges();
        expect(host.gridA.renderedRows()).toBe(2 + height);
        expect(host.gridA.grid.nativeElement.querySelector<HTMLElement>('ddl-item')!
          .style.getPropertyValue('--ddl-item-y')).toBe('1');
      }
      const rect = host.gridA.grid.nativeElement.getBoundingClientRect();
      document.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 32, clientX: rect.left + 1, clientY: rect.bottom - 1,
      }));
      vi.advanceTimersByTime(0);
      expect(host.itemsA).toEqual([existing, item('new', 1, 3, 2, height)]);
      expect(host.rowsA).toBe(2 + height);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const next = item('next', 1, 1, 2, height);
      TestBed.inject(GridService).startPaletteDrag(next, host.gridB.grid.nativeElement,
        new PointerEvent('pointerdown', {pointerId: 33}), ['grid-a'], null);
      const nextRect = host.gridA.grid.nativeElement.getBoundingClientRect();
      document.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 33, clientX: nextRect.left + 1, clientY: nextRect.bottom - 1,
      }));
      vi.advanceTimersByTime(0);
      expect(host.itemsA).toEqual([
        existing, item('new', 1, 3, 2, height), item('next', 1, 3 + height, 2, height),
      ]);
      expect(host.rowsA).toBe(2 + 2 * height);
    });
  }

  for (const policy of ['growth-disabled', 'bottom-omitted'] as const) {
    it(`keeps bottom-edge placement inside existing rows when ${policy}`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      const host = fixture.componentInstance;
      host.allowRowGrowth = policy !== 'growth-disabled';
      host.movePriority = policy === 'bottom-omitted' ? ['left', 'right', 'top'] : DEFAULT_MOVE_PRIORITY;
      host.itemsA = [item('existing', 1, 2)];
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      const grid = host.gridA;
      const snapshot = grid.snapshot();
      const session = makeSession('insert', item('new', 1, 1), grid.interactionGridId, snapshot);
      session.geometries.set(grid.interactionGridId, geometry);
      const preview = grid.preview(session, snapshot, {x: 150, y: 109}, {x: 0, y: 0});
      expect(preview.result.ok).toBe(true);
      if (preview.result.ok) {
        expect(preview.result.items).toEqual([item('existing', 1, 2), item('new', 2, 2)]);
        expect(preview.result.rows).toBe(2);
      }
    });
  }

  it('allows an existing item to append and return inside without committing temporary rows', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('active', 1, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    const session = makeSession('move', snapshot.items[0], grid.interactionGridId, snapshot);
    session.geometries.set(grid.interactionGridId, geometry);
    for (const y of [109, 200, 1000]) {
      const preview = grid.preview(session, snapshot, {x: 20, y}, {x: 0, y: 0});
      expect(preview.result.ok && preview.result.items).toEqual([item('active', 1, 3)]);
      expect(grid.renderedRows()).toBe(3);
    }
    grid.preview(session, snapshot, {x: 20, y: 70}, {x: 0, y: 0});
    grid.commitPreview();
    expect(grid.items()).toEqual([item('active', 1, 2)]);
    expect(grid.rows()).toBe(2);
  });

  for (const completion of ['pointerup', 'pointercancel'] as const) {
    it(`bounds transfer growth along the bottom edge and handles ${completion}`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      const host = fixture.componentInstance;
      host.columns = 1;
      host.itemsA = [item('blocker', 1, 2)];
      host.itemsB = [item('transfer', 1, 1, 1, 2)];
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();

      const sourceElement = host.gridB.grid.nativeElement.querySelector<HTMLElement>('ddl-item')!;
      const sourceRect = sourceElement.getBoundingClientRect();
      sourceElement.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 31, button: 0, clientX: sourceRect.left + 1, clientY: sourceRect.top + 1,
      }));
      const heights: number[] = [];
      for (let index = 0; index < 6; index++) {
        const targetRect = host.gridA.grid.nativeElement.getBoundingClientRect();
        document.dispatchEvent(new PointerEvent('pointermove', {
          pointerId: 31, clientX: targetRect.left + 1, clientY: targetRect.bottom - 1,
        }));
        vi.advanceTimersByTime(10);
        fixture.changeDetectorRef.markForCheck();
        fixture.detectChanges();
        heights.push(host.gridA.renderedRows());
      }
      expect(heights).toEqual([4, 4, 4, 4, 4, 4]);
      expect(host.rowsA).toBe(2);
      expect(host.itemsB).toEqual([item('transfer', 1, 1, 1, 2)]);
      const finalRect = host.gridA.grid.nativeElement.getBoundingClientRect();
      document.dispatchEvent(new PointerEvent(completion, {
        pointerId: 31, clientX: finalRect.left + 1, clientY: finalRect.bottom - 1,
      }));
      vi.advanceTimersByTime(0);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      if (completion === 'pointerup') {
        expect(host.rowsA).toBe(4);
        expect(host.itemsA).toEqual([item('blocker', 1, 2), expect.objectContaining(item('transfer', 1, 3, 1, 2))]);
        expect(host.itemsB).toEqual([]);
      } else {
        expect(host.gridA.renderedRows()).toBe(2);
        expect(host.itemsA).toEqual([item('blocker', 1, 2)]);
        expect(host.itemsB).toEqual([item('transfer', 1, 1, 1, 2)]);
      }
    });
  }

  it('restores columns and layout when a column-only reduction excludes an item', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('edge', 2, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridA;
    const original = grid.snapshot();
    const rejected = vi.fn();
    grid.placementRejected.subscribe(rejected);

    fixture.componentInstance.columns = 1;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(grid.columns()).toBe(2);
    expect(fixture.componentInstance.columns).toBe(2);
    expect(grid.snapshot()).toEqual(original);
    expect(grid.grid.nativeElement.style.getPropertyValue('--ddl-grid-columns')).toBe('2');
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected).toHaveBeenCalledWith(expect.objectContaining({operation: 'normalize', reason: 'out-of-bounds'}));
  });

  it('restores an oversized item and all dimensions before notifying rejection', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('wide', 1, 1, 2)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridA;
    const original = grid.snapshot();
    const rejected = vi.fn().mockImplementation(() => {
      expect(grid.snapshot()).toEqual(original);
      expect(fixture.componentInstance.columns).toBe(2);
      expect(fixture.componentInstance.rowsA).toBe(2);
      expect(grid.renderedRows()).toBe(2);
    });
    grid.placementRejected.subscribe(rejected);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.rowsA = 4;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected).toHaveBeenCalledWith(expect.objectContaining({reason: 'invalid-item'}));
  });

  it('keeps one-way columns compatible and emits the restored value', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsB = [item('edge', 2, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridB;
    const restored = vi.fn();
    grid.columns.subscribe(restored);
    fixture.componentInstance.columns = 1;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(grid.columns()).toBe(2);
    expect(grid.snapshot().columns).toBe(2);
    expect(fixture.componentInstance.columns).toBe(1);
    expect(restored).toHaveBeenCalledTimes(1);
    expect(restored).toHaveBeenCalledWith(2);
  });

  for (const initialItems of [[], [item('fits', 1, 1)]]) {
    it(`accepts column-only changes for ${initialItems.length ? 'fitting items' : 'an empty grid'}`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.itemsA = initialItems;
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      const grid = fixture.componentInstance.gridA;
      const rejected = vi.fn();
      grid.placementRejected.subscribe(rejected);
      for (const columns of [1, 4]) {
        fixture.componentInstance.columns = columns;
        fixture.changeDetectorRef.markForCheck();
        fixture.detectChanges();
        vi.advanceTimersByTime(0);
        expect(grid.snapshot()).toEqual({items: initialItems, columns, rows: 2});
        expect(grid.grid.nativeElement.style.getPropertyValue('--ddl-grid-columns')).toBe(columns.toString());
      }
      expect(rejected).not.toHaveBeenCalled();
    });
  }

  it('retains configured dimensions when an invalid initial layout becomes empty', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 5;
    fixture.componentInstance.rowsA = 8;
    fixture.componentInstance.itemsA = [item('bad', 6, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const grid = fixture.componentInstance.gridA;
    expect(grid.snapshot()).toEqual({items: [], columns: 5, rows: 8});
    expect(grid.renderedRows()).toBe(8);
    expect(fixture.componentInstance.itemsA).toEqual([]);
  });

  for (const cancellation of ['pointercancel', 'columns', 'rows'] as const) {
    it(`restores grown resize previews on ${cancellation} without committing`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      const active = item('active', 1, 1);
      fixture.componentInstance.itemsA = [active];
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      const grid = fixture.componentInstance.gridA;
      const service = TestBed.inject(GridService);
      vi.spyOn(grid, 'captureGeometry').mockReturnValue(geometry);
      const committed = vi.fn();
      const rejected = vi.fn();
      const itemsChanged = vi.fn();
      const rowsChanged = vi.fn();
      const ended = vi.fn();
      grid.placementCommitted.subscribe(committed);
      grid.placementRejected.subscribe(rejected);
      grid.items.subscribe(itemsChanged);
      grid.rows.subscribe(rowsChanged);
      service.pointerEnd$.subscribe(ended);
      service.startResize(grid, active, grid.grid.nativeElement,
        new PointerEvent('pointerdown', {pointerId: 9}), 'bottom', null);
      document.dispatchEvent(new PointerEvent('pointermove', {pointerId: 9, clientY: 200}));
      vi.advanceTimersByTime(10);
      expect(grid.renderedRows()).toBeGreaterThan(2);
      if (cancellation === 'columns') {
        fixture.componentInstance.columns = 1;
        fixture.changeDetectorRef.markForCheck();
        fixture.detectChanges();
      } else if (cancellation === 'rows') {
        fixture.componentInstance.rowsA = 3;
        fixture.changeDetectorRef.markForCheck();
        fixture.detectChanges();
      } else {
        document.dispatchEvent(new PointerEvent('pointercancel', {pointerId: 9}));
      }
      vi.advanceTimersByTime(0);
      document.dispatchEvent(new PointerEvent('pointerup', {pointerId: 9, clientY: 200}));
      vi.advanceTimersByTime(0);
      const expectedRows = cancellation === 'rows' ? 3 : 2;
      expect(grid.snapshot()).toEqual({items: [active], columns: cancellation === 'columns' ? 1 : 2, rows: expectedRows});
      expect(fixture.componentInstance.rowsA).toBe(expectedRows);
      expect(grid.renderedRows()).toBe(expectedRows);
      expect(grid.interactionMinHeight()).toBeNull();
      expect(committed).not.toHaveBeenCalled();
      expect(itemsChanged).not.toHaveBeenCalled();
      expect(rowsChanged).not.toHaveBeenCalled();
      expect(rejected).toHaveBeenCalledTimes(1);
      expect(rejected).toHaveBeenCalledWith(expect.objectContaining({reason: 'cancelled'}));
      expect(ended).toHaveBeenCalledTimes(1);
    });
  }

  describe('external updates during pointer interactions', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let service: GridService;
    let committed: ReturnType<typeof vi.fn>;
    let rejected: ReturnType<typeof vi.fn>;
    let ended: ReturnType<typeof vi.fn>;
    let moved: ReturnType<typeof vi.fn>;
    let itemsChanged: ReturnType<typeof vi.fn>;
    const active = item('a', 1, 1);

    function setup(): void {
      fixture = TestBed.createComponent(HostComponent);
      host = fixture.componentInstance;
      host.itemsA = [active];
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      service = TestBed.inject(GridService);
      committed = vi.fn();
      rejected = vi.fn();
      ended = vi.fn();
      moved = vi.fn();
      itemsChanged = vi.fn();
      for (const [grid, left] of [[host.gridA, 0], [host.gridB, 300]] as const) {
        vi.spyOn(grid.grid.nativeElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(left, 0, 210, 110));
        vi.spyOn(grid, 'captureGeometry').mockReturnValue({...geometry, viewportLeft: left});
        grid.placementCommitted.subscribe(committed);
        grid.placementRejected.subscribe(rejected);
        grid.items.subscribe(itemsChanged);
      }
      service.pointerEnd$.subscribe(ended);
      service.pointerMove$.subscribe(moved);
    }

    function pointer(type: string, x = 120, y = 20): void {
      document.dispatchEvent(new PointerEvent(type, {pointerId: 17, clientX: x, clientY: y}));
    }

    function startDrag(): void {
      host.gridA.grid.nativeElement.querySelector('ddl-item')!.dispatchEvent(
        new PointerEvent('pointerdown', {pointerId: 17, clientX: 20, clientY: 20, bubbles: true}),
      );
      pointer('pointermove');
      vi.advanceTimersByTime(10);
      expect(moved).toHaveBeenCalledTimes(1);
      expect(host.gridA.snapshot().items).toEqual([active]);
      expect(host.gridA.grid.nativeElement.querySelector('ddl-item')!.getAttribute('style')).toContain('--ddl-item-x: 2');
    }

    function settleUpdate(): void {
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      vi.advanceTimersByTime(0);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
    }

    function expectCancelled(operation: 'move' | 'transfer', x = 120): void {
      // Flush an already queued move, then send more events from the cancelled pointer.
      vi.advanceTimersByTime(10);
      pointer('pointermove', x);
      vi.advanceTimersByTime(10);
      pointer('pointerup', x);
      pointer('pointercancel', x);
      settleUpdate();
      expect(moved).toHaveBeenCalledTimes(operation === 'transfer' ? 2 : 1);
      expect(committed).not.toHaveBeenCalled();
      expect(ended).toHaveBeenCalledTimes(1);
      expect(rejected.mock.calls.filter(([event]) => event.reason === 'cancelled'))
        .toEqual([[expect.objectContaining({operation, reason: 'cancelled'})]]);
    }

    for (const update of [
      {name: 'adds an item', items: [active, item('b', 1, 2)]},
      {name: 'removes the dragged item', items: []},
      {name: 'replaces the dragged item', items: [item('replacement', 2, 2)]},
      {name: 'changes the dragged item position', items: [item('a', 2, 2)]},
      {name: 'changes only item data', items: [{...active, data: {label: 'updated'}}]},
    ]) {
      it(`preserves an external update that ${update.name}`, () => {
        setup();
        startDrag();
        pointer('pointermove', 20, 80);
        host.itemsA = update.items;
        settleUpdate();
        expectCancelled('move');
        expect(rejected).toHaveBeenCalledTimes(1);
        expect(itemsChanged).not.toHaveBeenCalled();
        expect(host.itemsA).toEqual(update.items);
        expect(host.gridA.snapshot().items).toEqual(update.items);
        expect(host.gridA.grid.nativeElement.querySelectorAll('ddl-item').length).toBe(update.items.length);
      });
    }

    for (const updatedGrid of ['source', 'target'] as const) {
      for (const update of ['items', 'rows'] as const) {
        it(`cancels a transfer when ${updatedGrid} ${update} change`, () => {
          setup();
          startDrag();
          pointer('pointermove', 320);
          vi.advanceTimersByTime(10);
          const sourceItem = host.gridA.grid.nativeElement.querySelector<HTMLElement>('ddl-item')!;
          expect(sourceItem.style.visibility).toBe('hidden');
          pointer('pointermove', 420);
          if (update === 'items') {
            if (updatedGrid === 'source') host.itemsA = [active, item('new', 1, 2)];
            else host.itemsB = [item('new', 1, 2)];
          } else {
            if (updatedGrid === 'source') host.rowsA = 3;
            else host.rowsB = 3;
          }
          const expectedA = {items: host.itemsA, rows: host.rowsA, columns: 2};
          const expectedB = {items: host.itemsB, rows: host.rowsB, columns: 2};
          settleUpdate();
          expectCancelled('transfer', 320);
          expect(rejected).toHaveBeenCalledTimes(1);
          expect(itemsChanged).not.toHaveBeenCalled();
          expect(host.gridA.snapshot()).toEqual(expectedA);
          expect(host.gridB.snapshot()).toEqual(expectedB);
          expect(host.itemsA).toEqual(expectedA.items);
          expect(host.itemsB).toEqual(expectedB.items);
          expect(sourceItem.style.visibility).toBe('');
          expect(host.gridA.renderedRows()).toBe(expectedA.rows);
          expect(host.gridB.renderedRows()).toBe(expectedB.rows);
        });
      }
    }

    for (const operation of ['move', 'resize', 'transfer'] as const) {
      it(`keeps equivalent replacements and internal ${operation} commits from cancelling`, () => {
        setup();
        let x = 120;
        let y = 20;
        if (operation === 'resize') {
          host.gridA.grid.nativeElement.querySelector('.resize-handle')!.dispatchEvent(
            new PointerEvent('pointerdown', {pointerId: 17, clientX: 20, clientY: 20, bubbles: true}),
          );
          x = 20;
          y = 200;
          pointer('pointermove', x, y);
          vi.advanceTimersByTime(10);
          expect(host.gridA.renderedRows()).toBeGreaterThan(2);
        } else {
          startDrag();
          if (operation === 'transfer') {
            x = 320;
            pointer('pointermove', x, y);
            vi.advanceTimersByTime(10);
          }
        }
        const previewRows = host.gridA.renderedRows();
        const previewHeight = host.gridA.interactionMinHeight();
        host.itemsA = host.itemsA.map((entry) => ({...entry}));
        host.itemsB = [...host.itemsB];
        settleUpdate();
        expect(ended).not.toHaveBeenCalled();
        expect(host.gridA.renderedRows()).toBe(previewRows);
        expect(host.gridA.interactionMinHeight()).toBe(previewHeight);
        pointer('pointerup', x, y);
        settleUpdate();
        expect(rejected).not.toHaveBeenCalled();
        expect(ended).toHaveBeenCalledTimes(1);
        expect(committed).toHaveBeenCalledTimes(1);
        expect(committed).toHaveBeenCalledWith(expect.objectContaining({operation}));
        expect(host.gridA.snapshot().items).toEqual(host.itemsA);
        expect(host.gridB.snapshot().items).toEqual(host.itemsB);
        if (operation === 'transfer') {
          expect(host.itemsA).toEqual([]);
          expect(host.itemsB).toEqual([expect.objectContaining(active)]);
        } else if (operation === 'move') {
          expect(host.itemsA).toEqual([expect.objectContaining(item('a', 2, 1))]);
        } else {
          expect(host.itemsA[0].height).toBeGreaterThan(1);
          expect(host.rowsA).toBe(previewRows);
          expect(host.gridA.interactionMinHeight()).toBeNull();
        }
      });
    }

    it('lets a drag commit when an uninvolved grid changes', () => {
      setup();
      startDrag();
      host.itemsB = [item('unrelated', 1, 1)];
      host.rowsB = 3;
      settleUpdate();
      expect(ended).not.toHaveBeenCalled();
      pointer('pointerup');
      settleUpdate();
      expect(rejected).not.toHaveBeenCalled();
      expect(committed).toHaveBeenCalledTimes(1);
      expect(committed).toHaveBeenCalledWith(expect.objectContaining({operation: 'move'}));
      expect(host.itemsA).toEqual([expect.objectContaining(item('a', 2, 1))]);
      expect(host.gridB.snapshot()).toEqual({items: [item('unrelated', 1, 1)], columns: 2, rows: 3});
    });

    it('cancels before rejecting an invalid external layout and preserves the last valid layout', () => {
      setup();
      startDrag();
      pointer('pointermove', 20, 80);
      host.itemsA = [item('invalid', 3, 1)];
      settleUpdate();
      expectCancelled('move');
      expect(rejected.mock.calls).toEqual([
        [expect.objectContaining({operation: 'move', reason: 'cancelled'})],
        [expect.objectContaining({operation: 'normalize', reason: 'out-of-bounds'})],
      ]);
      expect(host.itemsA).toEqual([active]);
      expect(host.gridA.snapshot()).toEqual({items: [active], columns: 2, rows: 2});
    });
  });

  it('normalizes programmatic collisions and keeps the later item fixed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('first', 1, 1), item('later', 1, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.componentInstance.itemsA.find((entry) => entry.id === 'later')).toEqual(item('later', 1, 1));
    expect(fixture.componentInstance.itemsA.find((entry) => entry.id === 'first')).toEqual(item('first', 1, 2));
  });

  it('keeps a later programmatic item fixed and grows rows for the displaced blocker', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.itemsA = [item('blocker', 1, 1, 1, 2), item('new', 1, 2)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.componentInstance.rowsA).toBe(4);
    expect(fixture.componentInstance.itemsA.find((entry) => entry.id === 'new')?.y,
      JSON.stringify(fixture.componentInstance.itemsA))
      .toBe(2);
    expect(fixture.componentInstance.itemsA.find((entry) => entry.id === 'blocker')?.y).toBe(3);
  });

  it('adds a fresh-array item between items that were present during initialization', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.rowsA = 4;
    fixture.componentInstance.itemsA = [
      item('a', 1, 1),
      item('b', 1, 2),
      item('c', 1, 3),
      item('d', 1, 4),
    ];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    fixture.componentInstance.itemsA = [...fixture.componentInstance.itemsA, item('new', 1, 2)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(fixture.componentInstance.rowsA).toBe(5);
    expect(fixture.componentInstance.itemsA.map((entry) => `${entry.id}:${entry.y}`))
      .toEqual(['a:1', 'b:3', 'c:4', 'd:5', 'new:2']);
  });

  it('lets an immutably added item move through original blockers', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.rowsA = 5;
    fixture.componentInstance.itemsA = [item('a', 1, 1, 1, 2), item('b', 1, 3, 1, 2)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    fixture.componentInstance.itemsA = [...fixture.componentInstance.itemsA, item('new', 1, 5)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
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
    expect(preview.result.ok).toBe(true);
    if (!preview.result.ok) return;
    expect(preview.result.rows).toBe(6);
    expect(preview.result.items.find((entry) => entry.id === 'new')?.y).toBe(2);
  });

  it('accepts an immutable item removal', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('remove', 1, 1), item('keep', 2, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    fixture.componentInstance.itemsA = fixture.componentInstance.itemsA
      .filter((entry) => entry.id !== 'remove');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(fixture.componentInstance.gridA.snapshot().items).toEqual([item('keep', 2, 1)]);
  });

  it('accepts an immutable item replacement in a new array', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('replace', 1, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    fixture.componentInstance.itemsA = fixture.componentInstance.itemsA
      .map((entry) => entry.id === 'replace' ? item('replace', 2, 2) : entry);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(fixture.componentInstance.gridA.snapshot().items).toEqual([item('replace', 2, 2)]);
  });

  it('preserves the last valid layout when a requested row reduction cannot fit', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.rowsA = 3;
    fixture.componentInstance.itemsA = [item('tall', 1, 1, 1, 3)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    fixture.componentInstance.rowsA = 2;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    expect(fixture.componentInstance.rowsA).toBe(3);
    expect(fixture.componentInstance.itemsA).toEqual([item('tall', 1, 1, 1, 3)]);
  });

  it('latches grown preview rows for the duration of an interaction', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.itemsA = [item('blocker', 1, 1, 1, 2)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    const session = makeSession('insert', item('new', 1, 1), grid.interactionGridId, snapshot);
    session.geometries.set(grid.interactionGridId, geometry);
    const grown = grid.preview(session, snapshot, {x: 20, y: 120}, {x: 0, y: 0});
    const backInside = grid.preview(session, snapshot, {x: 20, y: 20}, {x: 0, y: 0});
    expect(grown.result.ok).toBe(true);
    expect(grid.renderedRows()).toBeGreaterThan(2);
    expect(backInside.result.ok).toBe(true);
    expect(grid.renderedRows()).toBeGreaterThan(2);
  });

  it('previews fitted widths, restores preferred width, and commits only resolved dimensions', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 12;
    fixture.componentInstance.itemsA = [item('existing', 1, 1, 6)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    const session = makeSession('insert', item('new', 1, 1, 12), grid.interactionGridId, snapshot);
    session.geometries.set(grid.interactionGridId, {...geometry, width: 1310});
    const emitted = vi.fn();
    grid.items.subscribe(emitted);
    const solve = vi.spyOn(LayoutEngine.prototype, 'resolvePlacement');

    const fitted = grid.preview(session, snapshot, {x: 900, y: 20}, {x: 0, y: 0});
    grid.preview(session, snapshot, {x: 1300, y: 20}, {x: 0, y: 0});
    expect(solve).toHaveBeenCalledTimes(1);
    expect(fitted.result.ok && fitted.result.items.find((entry) => entry.id === 'new'))
      .toEqual(item('new', 7, 1, 6));
    expect(fitted.rect?.width).toBe(650);
    expect(grid.items()).toEqual(snapshot.items);
    expect(emitted).not.toHaveBeenCalled();

    const wide = grid.preview(session, snapshot, {x: 900, y: 70}, {x: 0, y: 0});
    expect(wide.result.ok && wide.result.items.find((entry) => entry.id === 'new'))
      .toEqual(item('new', 1, 2, 12));
    grid.preview(session, snapshot, {x: 900, y: 20}, {x: 0, y: 0});
    grid.commitPreview();
    expect(grid.items()).toEqual([item('existing', 1, 1, 6), item('new', 7, 1, 6)]);
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(session.item.width).toBe(12);
  });

  it('keeps fixed insertion and existing move/transfer widths instead of fitting them', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('existing', 1, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    for (const kind of ['fixed', 'move', 'transfer'] as const) {
      const session: InteractionSession = {
        ...makeSession(kind === 'fixed' ? 'insert' : 'move', item('new', 1, 1, 2), grid.interactionGridId, snapshot),
        ...(kind === 'transfer' ? {sourceGridId: 'grid-b'} : {}),
        insertion: {sizing: 'fixed', minWidth: 1},
      };
      session.geometries.set(grid.interactionGridId, geometry);
      const preview = grid.preview(session, snapshot, {x: 150, y: 20}, {x: 0, y: 0});
      expect(preview.result.ok).toBe(true);
      if (preview.result.ok) {
        expect(preview.result.items.find((entry) => entry.id === 'new')).toEqual(item('new', 1, 1, 2));
        expect(preview.result.items.find((entry) => entry.id === 'existing')?.y).toBe(2);
      }
      grid.clearPreview(snapshot);
    }
  });

  it('fits within the last row and restores preferred width at the bounded append position', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('existing', 1, 2)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    const session = makeSession('insert', item('new', 1, 1, 2, 2), grid.interactionGridId, snapshot);
    session.geometries.set(grid.interactionGridId, geometry);
    for (const y of [70, 109, 140, 200, 1000, 70]) {
      const preview = grid.preview(session, snapshot, {x: 150, y}, {x: 0, y: 0});
      expect(preview.result.ok).toBe(true);
      if (preview.result.ok) {
        expect(preview.result.items).toEqual([
          item('existing', 1, 2), y === 70 ? item('new', 2, 2, 1, 2) : item('new', 1, 3, 2, 2),
        ]);
        expect(preview.result.rows).toBe(y === 70 ? 3 : 4);
      }
    }
    grid.clearPreview(snapshot);
    expect(grid.renderedRows()).toBe(2);
  });

  it('commits required rows without retaining temporary rendered growth', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.columns = 1;
    fixture.componentInstance.rowsA = 2;
    fixture.componentInstance.itemsA = [item('blocker', 1, 1, 1, 2)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const grid = fixture.componentInstance.gridA;
    const snapshot = grid.snapshot();
    const session = makeSession('insert', item('new', 1, 1), grid.interactionGridId, snapshot);
    session.geometries.set(grid.interactionGridId, geometry);
    grid.preview(session, snapshot, {x: 20, y: 70}, {x: 0, y: 0});
    expect(grid.renderedRows()).toBe(4);
    const final = grid.preview(session, snapshot, {x: 20, y: 20}, {x: 0, y: 0});
    expect(grid.renderedRows()).toBe(4);
    expect(final.result.ok && final.result.rows).toBe(3);
    grid.commitPreview();
    expect(grid.rows()).toBe(3);
    expect(grid.renderedRows()).toBe(3);
  });

  it('locks auto-row height for corner resize and releases it for horizontal-only resize', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('active', 1, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
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
  });

  it('keeps preview row state local to the interacted grid', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.itemsA = [item('a', 1, 1)];
    fixture.componentInstance.itemsB = [item('b', 1, 1)];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const gridB = fixture.componentInstance.gridB;
    const snapshot = gridB.snapshot();
    const session = makeSession('resize', item('b', 1, 1), 'grid-b', snapshot, 'bottom');
    session.geometries.set('grid-b', geometry);
    gridB.preview(session, snapshot, {x: 20, y: 200}, {x: 0, y: 0});
    expect(gridB.renderedRows()).toBeGreaterThan(2);
    expect(fixture.componentInstance.gridA.renderedRows()).toBe(2);
  });
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

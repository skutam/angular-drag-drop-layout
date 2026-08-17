import {CommonModule} from '@angular/common';
import {Component, ViewChild} from '@angular/core';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DragItemDirective} from '../directives/drag-item.directive';
import {DragDropLayoutModule} from '../drag-drop-layout.module';
import {GridGeometrySnapshot} from '../geometry/grid-geometry';
import {ItemComponent} from '../item/item.component';
import {GridItem} from '../item/item.definitions';
import {PlaceholderRenderer} from '../placeholder';
import {GridService} from '../services/grid.service';
import {GridComponent} from './grid.component';

@Component({
  standalone: true,
  imports: [CommonModule, DragDropLayoutModule],
  template: `
    <ddl-grid #gridA gridId="a" [connectedTo]="['b']" [columns]="2" [(rows)]="rowsA" [(items)]="itemsA">
      <ddl-item *ngFor="let item of itemsA; trackBy: trackItem" [itemId]="item.id" [resizeTypes]="['bottom']" />
    </ddl-grid>
    <ddl-grid #gridB gridId="b" [columns]="2" [(rows)]="rowsB" [(items)]="itemsB">
      <ddl-item *ngFor="let item of itemsB; trackBy: trackItem" [itemId]="item.id" />
    </ddl-grid>
    <div ddlDragItems [targets]="['a']">
      <button ddlDragItem>Add item</button>
    </div>
  `,
})
class CompletionHostComponent {
  @ViewChild('gridA') public gridA!: GridComponent;
  @ViewChild('gridB') public gridB!: GridComponent;
  public rowsA = 2;
  public rowsB = 2;
  public itemsA: readonly GridItem[] = [{id: 'first', x: 1, y: 1, width: 1, height: 1}];
  public itemsB: readonly GridItem[] = [{id: 'next', x: 1, y: 1, width: 1, height: 1}];

  public trackItem(_: number, item: GridItem): string {
    return item.id;
  }
}

describe('Grid interaction completion callbacks', () => {
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

  beforeEach(() => TestBed.configureTestingModule({imports: [CompletionHostComponent]}));

  for (const scenario of [
    {operation: 'move', callback: 'placement'},
    {operation: 'move', callback: 'end'},
    {operation: 'resize', callback: 'end'},
    {operation: 'transfer', callback: 'placement'},
    {operation: 'outside', callback: 'placement'},
    {operation: 'insert', callback: 'end'},
    {operation: 'insert', callback: 'placement'},
  ] as const) {
    it(`preserves a new drag started by ${scenario.operation} ${scenario.callback}`, fakeAsync(() => {
      const fixture = TestBed.createComponent(CompletionHostComponent);
      fixture.detectChanges();
      tick();
      const host = fixture.componentInstance;
      for (const [grid, left] of [[host.gridA, 0], [host.gridB, 300]] as const) {
        spyOn(grid.grid.nativeElement, 'getBoundingClientRect').and.returnValue(new DOMRect(left, 0, 210, 110));
        spyOn(grid, 'captureGeometry').and.returnValue({...geometry, viewportLeft: left});
      }
      const components = fixture.debugElement.queryAll(By.directive(ItemComponent));
      const first: ItemComponent = components[0].componentInstance;
      const next: ItemComponent = components[1].componentInstance;
      const palette = fixture.debugElement.query(By.directive(DragItemDirective));
      const paletteDirective = palette.injector.get(DragItemDirective);
      const hide = spyOn(TestBed.inject(PlaceholderRenderer), 'hide').and.callThrough();
      const service = TestBed.inject(GridService);
      const ended = jasmine.createSpy('pointerEnd');
      service.pointerEnd$.subscribe(ended);
      const nextMoved = jasmine.createSpy('nextMoved');
      const nextEnded = jasmine.createSpy('nextEnded');
      next.dragMove.subscribe(nextMoved);
      next.dragEnd.subscribe(nextEnded);
      const committed = jasmine.createSpy('committed');
      const rejected = jasmine.createSpy('rejected');
      for (const grid of [host.gridA, host.gridB]) {
        grid.placementCommitted.subscribe(committed);
        grid.placementRejected.subscribe(rejected);
      }
      const order: string[] = [];
      let started = false;

      function complete(phase: 'end' | 'placement'): void {
        order.push(phase);
        expect(hide).toHaveBeenCalledTimes(1);
        // Completion callbacks must observe the committed or restored models.
        if (scenario.operation === 'transfer') {
          expect(host.itemsA).toEqual([]);
          expect(host.itemsB.find((item) => item.id === 'first'))
            .toEqual(jasmine.objectContaining({x: 2, y: 2}));
        } else if (scenario.operation === 'outside') {
          expect(host.itemsA[0]).toEqual(jasmine.objectContaining({x: 1, y: 1}));
          expect(first.element.style.visibility).toBe('');
          expect(first.x()).toBe(1);
        } else if (scenario.operation === 'resize') {
          expect(host.itemsA[0].height).toBe(2);
          expect(host.gridA.interactionMinHeight()).toBeNull();
        } else if (scenario.operation === 'insert') {
          expect(host.itemsA.length).toBe(2);
        } else {
          expect(host.itemsA[0].x).toBe(2);
        }
        if (phase === scenario.callback && !started) {
          started = true;
          next.element.dispatchEvent(pointer('pointerdown', 22, 320, 20));
        }
      }

      const endOutput = scenario.operation === 'insert' ? paletteDirective.dragEnd
        : scenario.operation === 'resize' ? first.resizeEnd : first.dragEnd;
      endOutput.subscribe(() => complete('end'));
      const resultGrid = scenario.operation === 'transfer' ? host.gridB : host.gridA;
      if (scenario.operation === 'outside') {
        resultGrid.placementRejected.subscribe(() => complete('placement'));
      } else {
        resultGrid.placementCommitted.subscribe((event) => {
          if (event.item.id !== 'next') complete('placement');
        });
      }

      const startElement: HTMLElement = scenario.operation === 'insert' ? palette.nativeElement
        : scenario.operation === 'resize' ? first.element.querySelector('.resize-handle')! : first.element;
      startElement.dispatchEvent(pointer('pointerdown', 11, 20, 20));
      const x = scenario.operation === 'outside' ? 800 : scenario.operation === 'transfer' ? 420
        : scenario.operation === 'resize' ? 20 : 120;
      const y = scenario.operation === 'resize' || scenario.operation === 'transfer' ? 80 : 20;
      document.dispatchEvent(pointer('pointermove', 11, x, y));
      tick(10);
      // Keep a move pending when the first pointer is released.
      document.dispatchEvent(pointer('pointermove', 11, x, y));
      document.dispatchEvent(pointer('pointerup', 11, x, y));
      fixture.detectChanges();
      tick(10);

      expect(order).toEqual(['end', 'placement']);
      expect(started).toBeTrue();
      expect(ended).toHaveBeenCalledTimes(1);
      expect(nextEnded).not.toHaveBeenCalled();
      expect(nextMoved).not.toHaveBeenCalled();
      expect(hide).toHaveBeenCalledTimes(1);
      document.dispatchEvent(pointer('pointermove', 11, 20, 80));
      tick(10);
      document.dispatchEvent(pointer('pointerup', 11, 20, 80));
      document.dispatchEvent(pointer('pointercancel', 11, 20, 80));
      expect(nextMoved).not.toHaveBeenCalled();
      expect(ended).toHaveBeenCalledTimes(1);

      document.dispatchEvent(pointer('pointermove', 22, 420, 20));
      tick(10);
      expect(nextMoved).toHaveBeenCalledTimes(1);
      document.dispatchEvent(pointer('pointerup', 22, 420, 20));
      fixture.detectChanges();
      tick();
      expect(nextEnded).toHaveBeenCalledTimes(1);
      expect(ended).toHaveBeenCalledTimes(2);
      expect(hide).toHaveBeenCalledTimes(2);
      expect(host.itemsB.find((item) => item.id === 'next')?.x).toBe(2);
      expect(committed).toHaveBeenCalledTimes(scenario.operation === 'outside' ? 1 : 2);
      expect(committed.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
        operation: 'move', item: jasmine.objectContaining({id: 'next', x: 2}),
      }));
      if (scenario.operation === 'outside') {
        expect(rejected).toHaveBeenCalledOnceWith(jasmine.objectContaining({reason: 'outside-grid'}));
      } else {
        expect(rejected).not.toHaveBeenCalled();
      }
    }));
  }
});

function pointer(type: string, pointerId: number, clientX: number, clientY: number): PointerEvent {
  return new PointerEvent(type, {pointerId, clientX, clientY, bubbles: true});
}

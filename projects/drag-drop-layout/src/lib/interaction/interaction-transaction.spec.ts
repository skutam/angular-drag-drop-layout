import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {GridGeometrySnapshot} from '../geometry/grid-geometry';
import {GridItem} from '../item/item.definitions';
import {LayoutSnapshot, PlacementCommittedEvent, PlacementRejectedEvent} from '../layout/layout.definitions';
import {GridRegistry} from '../services/grid-registry.service';
import {PlaceholderRenderer} from '../placeholder';
import {GridService} from '../services/grid.service';
import {GridInteractionAdapter, InteractionPreview, InteractionSession} from './interaction.definitions';

describe('interaction transaction', () => {
  let registry: GridRegistry;
  let service: GridService;
  let element: HTMLElement;
  const active: GridItem = {id: 'active', x: 1, y: 1, width: 1, height: 1};

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(GridRegistry);
    service = TestBed.inject(GridService);
    element = document.createElement('div');
    spyOn(element, 'getBoundingClientRect').and.returnValue(rect(0, 0, 50, 50));
  });

  it('rolls back pointer cancellation without committing or calculating another preview', fakeAsync(() => {
    const order: string[] = [];
    const grid = new FakeGrid('grid', [], () => true, order);
    registry.register(grid);
    const ended = jasmine.createSpy('ended');
    service.pointerEnd$.subscribe(ended);
    service.startResize(grid, active, element, pointer('pointerdown', 4, 0), 'bottom', null);
    document.dispatchEvent(pointer('pointermove', 4, 50));
    tick(10);
    const previewCount = grid.previewCount;
    document.dispatchEvent(pointer('pointercancel', 4, 50));
    tick();

    expect(order).toEqual([]);
    expect(grid.previewCount).toBe(previewCount);
    expect(grid.clearCount).toBe(1);
    expect(grid.rejected?.reason).toBe('cancelled');
    expect(ended).toHaveBeenCalledTimes(1);
  }));

  for (const operation of ['move', 'transfer', 'insert'] as const) {
    it(`restores a cancelled ${operation} and stops pending movement`, fakeAsync(() => {
      const order: string[] = [];
      const source = new FakeGrid('source', ['target'], () => operation === 'move', order);
      const target = operation === 'move' ? source : new FakeGrid('target', [], () => true, order);
      if (operation !== 'insert') registry.register(source);
      if (target !== source) registry.register(target);
      const hide = spyOn(TestBed.inject(PlaceholderRenderer), 'hide').and.callThrough();
      const ended = jasmine.createSpy('ended');
      service.pointerEnd$.subscribe(ended);
      if (operation === 'insert') {
        service.startPaletteDrag(active, element, pointer('pointerdown', 5, 0), ['target'], null);
      } else {
        service.startGridDrag(source, active, element, pointer('pointerdown', 5, 0), {x: 0, y: 0}, null);
      }
      document.dispatchEvent(pointer('pointermove', 5, 150));
      tick(10);
      const previewCount = target.previewCount;
      // Cancel while another audited pointer move is still pending.
      document.dispatchEvent(pointer('pointermove', 5, 170));
      document.dispatchEvent(pointer('pointercancel', 5, 170));
      document.dispatchEvent(pointer('pointerup', 5, 170));
      document.dispatchEvent(pointer('pointercancel', 5, 170));
      tick(20);

      expect(order).toEqual([]);
      expect(target.previewCount).toBe(previewCount);
      expect(target.clearCount).toBe(1);
      if (operation === 'transfer') expect(source.clearCount).toBe(1);
      expect(target.rejections.length).toBe(1);
      expect(target.rejected).toEqual(jasmine.objectContaining({reason: 'cancelled', operation}));
      expect(ended).toHaveBeenCalledTimes(1);
      expect(hide).toHaveBeenCalledTimes(1);
    }));
  }

  it('ends a cancelled palette candidate even when it never entered a grid', fakeAsync(() => {
    const ended = jasmine.createSpy('ended');
    service.pointerEnd$.subscribe(ended);
    const hide = spyOn(TestBed.inject(PlaceholderRenderer), 'hide').and.callThrough();
    service.startPaletteDrag(active, element, pointer('pointerdown', 6, 0), [], null);
    document.dispatchEvent(pointer('pointercancel', 6, 0));
    tick();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledTimes(1);
  }));

  it('ignores cancellation from another pointer and column changes in an unrelated grid', fakeAsync(() => {
    const order: string[] = [];
    const grid = new FakeGrid('grid', [], () => true, order);
    registry.register(grid);
    service.startResize(grid, active, element, pointer('pointerdown', 7, 0), 'bottom', null);
    document.dispatchEvent(pointer('pointercancel', 8, 0));
    service.cancelForGrid('unrelated');
    document.dispatchEvent(pointer('pointerup', 7, 50));
    tick();
    expect(order).toEqual(['grid:commit', 'grid:event']);
    expect(grid.rejected).toBeNull();
  }));

  it('ends a superseded interaction before starting the next one', fakeAsync(() => {
    const order: string[] = [];
    const grid = new FakeGrid('grid', [], () => true, order);
    registry.register(grid);
    const ended = jasmine.createSpy('ended');
    service.pointerEnd$.subscribe(ended);
    service.startResize(grid, active, element, pointer('pointerdown', 10, 0), 'bottom', null);
    service.startResize(grid, active, element, pointer('pointerdown', 11, 0), 'right', null);
    expect(grid.rejections.length).toBe(1);
    expect(grid.rejected?.reason).toBe('cancelled');
    expect(ended).toHaveBeenCalledTimes(1);
    document.dispatchEvent(pointer('pointerup', 10, 50));
    expect(order).toEqual([]);
    document.dispatchEvent(pointer('pointerup', 11, 50));
    tick();
    expect(order).toEqual(['grid:commit', 'grid:event']);
    expect(ended).toHaveBeenCalledTimes(2);
  }));

  it('commits a transfer destination-first and emits after both models changed', fakeAsync(() => {
    const order: string[] = [];
    const source = new FakeGrid('source', ['destination'], () => false, order);
    const destination = new FakeGrid('destination', [], (pointer) => pointer.x >= 100, order);
    registry.register(source);
    registry.register(destination);
    spyOn(TestBed.inject(PlaceholderRenderer), 'hide').and.callFake(() => order.push('cleanup'));
    service.pointerEnd$.subscribe(() => order.push('end'));
    service.startGridDrag(source, active, element, pointer('pointerdown', 1, 0), {x: 0, y: 0}, null);
    document.dispatchEvent(pointer('pointermove', 1, 150));
    tick(10);
    document.dispatchEvent(pointer('pointerup', 1, 150));
    tick();
    expect(order).toEqual(['destination:commit', 'source:remove', 'cleanup', 'end', 'destination:event']);
  }));

  it('restores a rejected preview before cleanup and completion callbacks', fakeAsync(() => {
    const order: string[] = [];
    const grid = new FakeGrid('grid', [], () => true, order);
    registry.register(grid);
    spyOn(grid, 'preview').and.returnValue({result: {ok: false, reason: 'no-space', attemptedItem: active}});
    spyOn(grid, 'clearPreview').and.callFake(() => order.push('restore'));
    spyOn(grid, 'notifyPlacementRejected').and.callFake((event) => order.push(event.reason));
    spyOn(TestBed.inject(PlaceholderRenderer), 'hide').and.callFake(() => order.push('cleanup'));
    service.pointerEnd$.subscribe(() => order.push('end'));
    service.startResize(grid, active, element, pointer('pointerdown', 20, 0), 'bottom', null);
    document.dispatchEvent(pointer('pointerup', 20, 50));
    tick();
    expect(order).toEqual(['restore', 'cleanup', 'end', 'no-space']);
  }));

  it('restores the source and reports outside-grid when an existing item is dropped outside', fakeAsync(() => {
    const order: string[] = [];
    const source = new FakeGrid('source', [], () => false, order);
    registry.register(source);
    service.startGridDrag(source, active, element, pointer('pointerdown', 2, 0), {x: 0, y: 0}, null);
    document.dispatchEvent(pointer('pointermove', 2, 300));
    tick(10);
    document.dispatchEvent(pointer('pointerup', 2, 300));
    tick();
    expect(order).not.toContain('source:commit');
    expect(source.rejected?.reason).toBe('outside-grid');
    expect(source.clearCount).toBeGreaterThan(0);
  }));

  it('does not enter an unconnected grid', fakeAsync(() => {
    const source = new FakeGrid('source', [], () => false, []);
    const unconnected = new FakeGrid('unconnected', [], (pointer) => pointer.x >= 100, []);
    registry.register(source);
    registry.register(unconnected);
    service.startGridDrag(source, active, element, pointer('pointerdown', 3, 0), {x: 0, y: 0}, null);
    document.dispatchEvent(pointer('pointermove', 3, 150));
    tick(10);
    document.dispatchEvent(pointer('pointerup', 3, 150));
    tick();
    expect(unconnected.previewCount).toBe(0);
    expect(source.rejected?.reason).toBe('not-connected');
  }));

  for (const completion of ['pointermove', 'pointerup']) {
    it(`stops processing ${completion} when a move callback cancels the session`, fakeAsync(() => {
      const order: string[] = [];
      const grid = new FakeGrid('grid', [], () => true, order);
      registry.register(grid);
      const ended = jasmine.createSpy('ended');
      service.pointerEnd$.subscribe(ended);
      service.pointerMove$.subscribe(() => service.cancelForGrid('grid'));
      service.startResize(grid, active, element, pointer('pointerdown', 50, 0), 'bottom', null);
      document.dispatchEvent(pointer(completion, 50, 50));
      tick(10);
      expect(grid.previewCount).toBe(0);
      expect(order).toEqual([]);
      expect(ended).toHaveBeenCalledTimes(1);
      expect(grid.rejected?.reason).toBe('cancelled');
    }));
  }

  it('keeps the active pointer move when another pointer moves in the same audit window', fakeAsync(() => {
    const grid = new FakeGrid('grid', [], () => true, []);
    registry.register(grid);
    service.startResize(grid, active, element, pointer('pointerdown', 60, 0), 'bottom', null);
    document.dispatchEvent(pointer('pointermove', 60, 50));
    document.dispatchEvent(pointer('pointermove', 61, 150));
    tick(10);
    expect(grid.previewCount).toBe(1);
    document.dispatchEvent(pointer('pointercancel', 60, 50));
  }));

  it('leaves a replacement session active when it starts during the previous release', fakeAsync(() => {
    const order: string[] = [];
    const grid = new FakeGrid('grid', [], () => true, order);
    registry.register(grid);
    let replaced = false;
    service.pointerMove$.subscribe(() => {
      if (replaced) return;
      replaced = true;
      service.startResize(grid, active, element, pointer('pointerdown', 71, 0), 'right', null);
    });
    service.startResize(grid, active, element, pointer('pointerdown', 70, 0), 'bottom', null);
    document.dispatchEvent(pointer('pointerup', 70, 50));
    tick();
    expect(order).toEqual([]);
    expect(grid.previewCount).toBe(0);
    document.dispatchEvent(pointer('pointerup', 71, 50));
    tick();
    expect(order).toEqual(['grid:commit', 'grid:event']);
  }));

  it('reports transfer when the destination rejects an existing item', fakeAsync(() => {
    const source = new FakeGrid('source', ['target'], () => false, []);
    const target = new FakeGrid('target', [], () => true, []);
    registry.register(source);
    registry.register(target);
    spyOn(target, 'preview').and.returnValue({result: {ok: false, reason: 'no-space', attemptedItem: active}});
    service.startGridDrag(source, active, element, pointer('pointerdown', 80, 0), {x: 0, y: 0}, null);
    document.dispatchEvent(pointer('pointerup', 80, 150));
    tick();
    expect(target.rejected).toEqual(jasmine.objectContaining({operation: 'transfer', reason: 'no-space'}));
    expect(source.clearCount).toBe(1);
    expect(target.clearCount).toBe(1);
  }));
});

class FakeGrid implements GridInteractionAdapter {
  public readonly layout: LayoutSnapshot = {items: [{id: 'active', x: 1, y: 1, width: 1, height: 1}], columns: 2, rows: 2};
  public previewCount = 0;
  public clearCount = 0;
  public rejected: PlacementRejectedEvent | null = null;
  public readonly rejections: PlacementRejectedEvent[] = [];

  public constructor(
    public readonly interactionGridId: string,
    public readonly interactionConnectedTo: readonly string[],
    private readonly hitTest: (pointer: {x: number; y: number}) => boolean,
    private readonly order: string[],
  ) {}

  public containsPointer(pointer: {x: number; y: number}): boolean {
    return this.hitTest(pointer);
  }

  public snapshot(): LayoutSnapshot {
    return this.layout;
  }

  public captureGeometry(): GridGeometrySnapshot {
    return {
      viewportLeft: 0,
      viewportTop: 0,
      width: 200,
      columnWidth: 95,
      columnGap: 10,
      rowGap: 10,
      rowHeights: [50, 50],
      fallbackRowHeight: 50,
      scroll: {x: 0, y: 0},
    };
  }

  public preview(session: InteractionSession): InteractionPreview {
    this.previewCount++;
    return {
      result: {ok: true, items: [session.item], rows: 2},
      rect: {left: 100, top: 0, width: 50, height: 50},
    };
  }

  public previewSourceRemoval(): void {}

  public clearPreview(): void {
    this.clearCount++;
  }

  public commitPreview(): void {
    this.order.push(`${this.interactionGridId}:commit`);
  }

  public commitSourceRemoval(): void {
    this.order.push(`${this.interactionGridId}:remove`);
  }

  public notifyPlacementCommitted(_: PlacementCommittedEvent): void {
    this.order.push(`${this.interactionGridId}:event`);
  }

  public notifyPlacementRejected(event: PlacementRejectedEvent): void {
    this.rejected = event;
    this.rejections.push(event);
  }
}

function pointer(type: string, pointerId: number, x: number): PointerEvent {
  return new PointerEvent(type, {pointerId, clientX: x, clientY: 10, bubbles: true});
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({})};
}

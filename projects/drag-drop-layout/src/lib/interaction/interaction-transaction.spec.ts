import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {GridGeometrySnapshot} from '../geometry/grid-geometry';
import {GridItem} from '../item/item.definitions';
import {LayoutSnapshot, PlacementCommittedEvent, PlacementRejectedEvent} from '../layout/layout.definitions';
import {GridRegistry} from '../services/grid-drag-item.service';
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

  it('commits a transfer destination-first and emits after both models changed', fakeAsync(() => {
    const order: string[] = [];
    const source = new FakeGrid('source', ['destination'], () => false, order);
    const destination = new FakeGrid('destination', [], (pointer) => pointer.x >= 100, order);
    registry.register(source);
    registry.register(destination);
    service.startGridDrag(source, active, element, pointer('pointerdown', 1, 0), {x: 0, y: 0}, null);
    document.dispatchEvent(pointer('pointermove', 1, 150));
    tick(10);
    document.dispatchEvent(pointer('pointerup', 1, 150));
    tick();
    expect(order).toEqual(['destination:commit', 'source:remove', 'destination:event']);
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
});

class FakeGrid implements GridInteractionAdapter {
  public readonly layout: LayoutSnapshot = {items: [{id: 'active', x: 1, y: 1, width: 1, height: 1}], columns: 2, rows: 2};
  public previewCount = 0;
  public clearCount = 0;
  public rejected: PlacementRejectedEvent | null = null;

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
  }
}

function pointer(type: string, pointerId: number, x: number): PointerEvent {
  return new PointerEvent(type, {pointerId, clientX: x, clientY: 10, bubbles: true});
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({})};
}

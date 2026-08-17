import {Component, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {DragDropLayoutModule} from '../drag-drop-layout.module';
import {GridComponent} from '../grid/grid.component';
import {GridItem} from '../item/item.definitions';
import {InsertionSizing} from '../layout/layout.definitions';
import {PlaceholderRenderer} from '../placeholder';

@Component({
  standalone: true,
  imports: [CommonModule, DragDropLayoutModule],
  template: `
    <div ddlDragItems [targets]="['target']">
      <div ddlDragItem [width]="12" [minInsertionWidth]="minimum" [insertionSizing]="sizing">Input</div>
    </div>
    <ddl-grid gridId="target" [columns]="12" [(items)]="items" [(rows)]="rows">
      <ddl-item *ngFor="let item of items" [itemId]="item.id"></ddl-item>
    </ddl-grid>
  `,
})
class PaletteHost {
  @ViewChild(GridComponent) grid!: GridComponent;
  public rows = 2;
  public sizing: InsertionSizing = 'fit-width';
  public minimum = 3;
  public items: readonly GridItem[] = [{id: 'existing', x: 1, y: 1, width: 6, height: 1}];
}

describe('DragItemDirective insertion transaction', () => {
  for (const action of ['drop', 'cancel', 'fixed', 'minimum'] as const) {
    it(`previews the configured insertion and handles ${action} atomically`, fakeAsync(() => {
      TestBed.configureTestingModule({imports: [PaletteHost]});
      const fixture = TestBed.createComponent(PaletteHost);
      const host = fixture.componentInstance;
      if (action === 'fixed') host.sizing = 'fixed';
      if (action === 'minimum') host.minimum = 7;
      fixture.detectChanges();
      tick();
      const original = host.grid.snapshot();
      spyOn(host.grid, 'containsPointer').and.returnValue(true);
      spyOn(host.grid, 'captureGeometry').and.returnValue({
        viewportLeft: 0, viewportTop: 0, width: 1200, columnWidth: 100,
        columnGap: 0, rowGap: 0, rowHeights: [50, 50], fallbackRowHeight: 50, scroll: {x: 0, y: 0},
      });
      const placeholder = spyOn(TestBed.inject(PlaceholderRenderer), 'update').and.callThrough();
      const committed = jasmine.createSpy('committed');
      const rejected = jasmine.createSpy('rejected');
      host.grid.placementCommitted.subscribe(committed);
      host.grid.placementRejected.subscribe(rejected);
      const palette: HTMLElement = fixture.nativeElement.querySelector('[ddlDragItem]');
      const event = (type: string) => new PointerEvent(type, {
        pointerId: 42, clientX: 850, clientY: 20, button: 0, bubbles: true,
      });
      palette.dispatchEvent(event('pointerdown'));
      document.dispatchEvent(event('pointermove'));
      tick(10);
      const width = action === 'fixed' || action === 'minimum' ? 12 : 6;
      expect(placeholder.calls.mostRecent().args[0].width).toBe(width * 100);
      expect(host.items).toEqual(original.items);
      expect(committed).not.toHaveBeenCalled();
      document.dispatchEvent(event(action === 'cancel' ? 'pointercancel' : 'pointerup'));
      tick();
      fixture.detectChanges();
      if (action === 'cancel') {
        expect(host.grid.snapshot()).toEqual(original);
        expect(committed).not.toHaveBeenCalled();
        expect(rejected).toHaveBeenCalledWith(jasmine.objectContaining({reason: 'cancelled'}));
      } else {
        expect(committed).toHaveBeenCalledTimes(1);
        expect(committed.calls.mostRecent().args[0].item.width).toBe(width);
        expect(host.items.find((item) => item.id !== 'existing')?.width).toBe(width);
        expect(host.items.find((item) => item.id === 'existing')?.y).toBe(width === 6 ? 1 : 2);
        expect(host.rows).toBe(2);
        expect(rejected).not.toHaveBeenCalled();
      }
      expect(palette.isConnected).toBeTrue();
    }));
  }
});

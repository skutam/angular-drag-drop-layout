import {Component} from '@angular/core';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {DragDropLayoutModule} from '../drag-drop-layout.module';
import {GridService} from '../services/grid.service';

@Component({
  standalone: true,
  imports: [DragDropLayoutModule],
  template: `
    <ddl-grid gridId="grid" [items]="items">
      <ddl-item itemId="item" [draggable]="draggable">
        <button ddlDragHandle>Move</button>
      </ddl-item>
    </ddl-grid>
  `,
})
class ItemHost {
  public draggable = false;
  public items = [{id: 'item', x: 1, y: 1, width: 1, height: 1}];
}

describe('ItemComponent drag handles', () => {
  it('responds to draggable changes without recreating the handle', fakeAsync(() => {
    TestBed.configureTestingModule({imports: [ItemHost]});
    const fixture = TestBed.createComponent(ItemHost);
    fixture.detectChanges();
    tick();
    const start = spyOn(TestBed.inject(GridService), 'startGridDrag');
    const handle: HTMLElement = fixture.nativeElement.querySelector('[ddlDragHandle]');
    const press = () => handle.dispatchEvent(new PointerEvent('pointerdown', {button: 0, bubbles: true}));
    press();
    expect(start).not.toHaveBeenCalled();
    fixture.componentInstance.draggable = true;
    fixture.detectChanges();
    press();
    expect(start).toHaveBeenCalledTimes(1);
    fixture.componentInstance.draggable = false;
    fixture.detectChanges();
    press();
    expect(start).toHaveBeenCalledTimes(1);
  }));
});

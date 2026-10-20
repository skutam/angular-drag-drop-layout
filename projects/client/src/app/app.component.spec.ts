import {describe, it, expect} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {createGridItem} from '@skutam/drag-drop-layout';
import {AppComponent} from './app.component';

describe('AppComponent', () => {
  it('renders the grids, palette, and placement controls', async () => {
    await TestBed.configureTestingModule({imports: [AppComponent]}).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('ddl-grid').length).toBe(2);
    expect(element.querySelectorAll('ddl-item').length).toBe(5);
    expect(element.querySelectorAll('[ddlDragItem]').length).toBe(3);
    expect(element.querySelectorAll('.remove-item-btn').length).toBe(5);
    expect(element.textContent).toContain('Down, left, right, up');
  });

  it('adds wide items within the configured columns', () => {
    const app = new AppComponent();
    app.columns = 4;
    app.itemsTop = [createGridItem({x: 3, y: 1, width: 2, height: 1})];
    app.addItemTop();
    expect(app.itemsTop[1]).toEqual(expect.objectContaining({x: 3, y: 2, width: 2}));
  });
});

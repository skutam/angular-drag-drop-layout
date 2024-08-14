import {Directive, HostListener, output} from '@angular/core';

@Directive({
  selector: '[ddlDragHandle]',
})
export class DragHandleDirective {
  public dragStart = output<PointerEvent>();

  @HostListener('pointerdown', ['$event'])
  public startDrag(event: PointerEvent) {
    /**
     * Only start dragging if the left mouse button is pressed.
     * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#determining_button_states
     */
    if (event.button !== 0 && event.buttons !== 1) {
      return;
    }

    this.dragStart.emit(event);
    event.preventDefault();
  }
}

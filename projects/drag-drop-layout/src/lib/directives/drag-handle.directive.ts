import {Directive, HostListener, input, output} from '@angular/core';

@Directive({
  selector: '[ddlDragHandle]',
  host: {
    '[draggable]': 'draggable() && !disabled()',
    '[disabled]': 'disabled()',
    '[style.cursor]': 'disabled() ? "not-allowed" : (draggable() ? "move" : "default")',
  },
})
export class DragHandleDirective {
  // Inputs
  public draggable = input(true);
  public disabled = input(false);

  // Outputs
  public dragStart = output<PointerEvent>();

  @HostListener('pointerdown', ['$event'])
  public startDrag(event: PointerEvent) {
    if (!this.draggable() || this.disabled()) {
      return;
    }
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

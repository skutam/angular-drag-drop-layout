import {DestroyRef, Directive, ElementRef, HostListener, Inject, input, output} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {take, takeUntil} from 'rxjs';
import {IPosition} from '../definitions';
import {GridItem} from '../item/item.definitions';
import {GridService} from '../services/grid.service';
import {getScrollOffset} from '../util';

export interface DragItemDragEvent {
  readonly event: IPosition;
  readonly scroll: IPosition;
}

@Directive({
  selector: '[ddlDragItem]',
  host: {
    '[draggable]': 'draggable() && !disabled()',
    '[attr.disabled]': 'disabled() ? true : null',
    '[style.cursor]': 'disabled() ? "not-allowed" : (draggable() ? "move" : "default")',
  },
})
export class DragItemDirective {
  public readonly draggable = input(true);
  public readonly disabled = input(false);
  public readonly width = input(1);
  public readonly height = input(1);
  public readonly dragData = input<unknown>();
  public readonly scrollableElement = input<HTMLElement | Document | null>(null);

  public readonly dragStart = output<DragItemDragEvent>();
  public readonly dragMove = output<DragItemDragEvent>();
  public readonly dragEnd = output<DragItemDragEvent>();

  private targets: readonly string[] = [];

  public constructor(
    private readonly gridService: GridService,
    @Inject(ElementRef) public readonly dragItem: ElementRef<HTMLElement>,
    private readonly destroyRef: DestroyRef,
  ) {}

  public setTargets(targets: readonly string[]): void {
    this.targets = targets;
  }

  @HostListener('pointerdown', ['$event'])
  public startDrag(event: PointerEvent): void {
    if ((event.button !== 0 && event.buttons !== 1) || !this.draggable() || this.disabled()) return;
    event.preventDefault();
    const scroll = getScrollOffset(this.scrollableElement());
    this.dragStart.emit({event, scroll});
    const item: GridItem = Object.freeze({
      id: crypto.randomUUID(),
      x: 1,
      y: 1,
      width: this.width(),
      height: this.height(),
      data: this.dragData(),
    });
    this.gridService.startPaletteDrag(item, this.dragItem.nativeElement, event, this.targets, this.scrollableElement());
    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
    ).subscribe(({event: pointer, scroll: nextScroll}) => this.dragMove.emit({event: pointer, scroll: nextScroll}));
    this.gridService.pointerEnd$.pipe(takeUntilDestroyed(this.destroyRef), take(1))
      .subscribe(({event: pointer, scroll: endScroll}) => this.dragEnd.emit({event: pointer, scroll: endScroll}));
  }
}

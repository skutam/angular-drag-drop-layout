import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  Inject,
  input,
  OnDestroy,
  output,
  OutputRefSubscription,
  QueryList,
  signal,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {take, takeUntil} from 'rxjs';
import {DragHandleDirective} from '../directives/drag-handle.directive';
import {getScrollOffset} from '../util';
import {GridService} from '../services/grid.service';
import {GridItem, ItemDragEvent, ItemResizeEvent, ResizeType} from './item.definitions';

@Component({
  selector: 'ddl-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item.component.html',
  styleUrl: './item.component.css',
  host: {
    '[draggable]': 'draggable() && dragHandles.length === 0 && !disabled()',
    '[attr.disabled]': 'disabled() ? true : null',
    '[style.cursor]': 'disabled() ? "not-allowed" : (draggable() && dragHandles.length === 0 ? "move" : "default")',
    '[style.visibility]': 'previewHidden() ? "hidden" : null',
  },
})
export class ItemComponent implements AfterViewInit, OnDestroy {
  @ContentChildren(DragHandleDirective, {descendants: true}) protected dragHandles!: QueryList<DragHandleDirective>;

  public readonly itemId = input.required<string>();
  public readonly resizeTypes = input<ResizeType[]>(['bottom-left']);
  public readonly draggable = input(true);
  public readonly resizable = input(true);
  public readonly disabled = input(false);

  public readonly dragStart = output<ItemDragEvent>();
  public readonly dragMove = output<ItemDragEvent>();
  public readonly dragEnd = output<ItemDragEvent>();
  public readonly resizeStart = output<ItemResizeEvent>();
  public readonly resizeMove = output<ItemResizeEvent>();
  public readonly resizeEnd = output<ItemResizeEvent>();

  public readonly x = signal(1);
  public readonly y = signal(1);
  public readonly width = signal(1);
  public readonly height = signal(1);
  public readonly data = signal<unknown>(undefined);
  public readonly scrollableElement = signal<HTMLElement | Document | null>(null);
  public readonly previewHidden = signal(false);
  public readonly element: HTMLDivElement;

  private dragHandleSubscriptions: OutputRefSubscription[] = [];

  public constructor(
    @Inject(ElementRef) item: ElementRef<HTMLDivElement>,
    private readonly gridService: GridService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.element = item.nativeElement;
    this.bindCssProperty('--ddl-item-x', this.x);
    this.bindCssProperty('--ddl-item-y', this.y);
    this.bindCssProperty('--ddl-item-width', this.width);
    this.bindCssProperty('--ddl-item-height', this.height);
  }

  public ngAfterViewInit(): void {
    this.dragHandles.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.registerDragHandles());
    this.registerDragHandles();
  }

  public ngOnDestroy(): void {
    this.dragHandleSubscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  @HostListener('pointerdown', ['$event'])
  public hostStartDrag(event: PointerEvent): void {
    if ((event.button !== 0 && event.buttons !== 1) || !this.draggable() || this.disabled()) return;
    if (this.dragHandles.length !== 0 || event.target !== this.element) return;
    event.preventDefault();
    this.startDrag(event);
  }

  public startDrag(event: PointerEvent): void {
    this.dragStart.emit({item: this.getItem(), event, scroll: getScrollOffset(this.scrollableElement())});
    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
    ).subscribe(({event: pointer, scroll}) => this.dragMove.emit({item: this.getItem(), event: pointer, scroll}));
    this.gridService.pointerEnd$.pipe(takeUntilDestroyed(this.destroyRef), take(1))
      .subscribe(({event: pointer, scroll}) => this.dragEnd.emit({item: this.getItem(), event: pointer, scroll}));
  }

  public startResize(event: PointerEvent, resizeType: ResizeType): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeStart.emit({item: this.getItem(), event, resizeType, scroll: getScrollOffset(this.scrollableElement())});
    this.gridService.pointerMove$.pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.gridService.pointerEnd$),
    ).subscribe(({event: pointer, scroll}) => this.resizeMove.emit({item: this.getItem(), event: pointer, resizeType, scroll}));
    this.gridService.pointerEnd$.pipe(takeUntilDestroyed(this.destroyRef), take(1))
      .subscribe(({event: pointer, scroll}) => this.resizeEnd.emit({item: this.getItem(), event: pointer, resizeType, scroll}));
  }

  public render(item: GridItem, hidden = false): void {
    this.x.set(item.x);
    this.y.set(item.y);
    this.width.set(item.width);
    this.height.set(item.height);
    this.data.set(item.data);
    this.previewHidden.set(hidden);
    this.element.style.setProperty('--ddl-item-x', item.x.toString());
    this.element.style.setProperty('--ddl-item-y', item.y.toString());
    this.element.style.setProperty('--ddl-item-width', item.width.toString());
    this.element.style.setProperty('--ddl-item-height', item.height.toString());
    this.element.style.visibility = hidden ? 'hidden' : '';
  }

  public getItem(): GridItem {
    return Object.freeze({
      id: this.itemId(),
      x: this.x(),
      y: this.y(),
      width: this.width(),
      height: this.height(),
      data: this.data(),
    });
  }

  private registerDragHandles(): void {
    this.dragHandleSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.dragHandleSubscriptions = [];
    this.dragHandles.forEach((handle) => {
      handle.draggable = this.draggable;
      handle.disabled = this.disabled;
      if (this.draggable()) {
        this.dragHandleSubscriptions.push(handle.dragStart.subscribe((event) => this.startDrag(event)));
      }
    });
  }

  private bindCssProperty(property: string, value: {(): number}): void {
    effect(() => this.element.style.setProperty(property, value().toString()));
  }
}

import {DestroyRef, Inject, Injectable, NgZone} from '@angular/core';
import {Item} from "../item/item.definitions";
import {ItemComponent} from "../item/item.component";
import {DOCUMENT} from "@angular/common";
import {
  filter,
  fromEvent,
  Observable,
  sampleTime,
  Subject,
  takeUntil
} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Injectable({
  providedIn: 'root'
})
export class GridService {
  private _dragging = false;
  private _resizing = false;

  public pointerMove: Observable<PointerEvent>;
  private pointerMoveSubject: Subject<PointerEvent> = new Subject<PointerEvent>();

  public pointerEnd: Observable<PointerEvent>;
  private pointerEndSubject: Subject<PointerEvent> = new Subject<PointerEvent>();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private destroyRef: DestroyRef,
    private ngZone: NgZone,
  ) {
    this.pointerMove = this.pointerMoveSubject.asObservable();
    this.pointerEnd = this.pointerEndSubject.asObservable();

    this.ngZone.runOutsideAngular(() => {
      fromEvent<PointerEvent>(this.document, 'pointermove').pipe(
        takeUntil(this.pointerEnd),
        sampleTime(20),
        filter(() => this._dragging || this._resizing),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe((event: PointerEvent) => {
        this.pointerMoveSubject.next(event);
      });

      fromEvent<PointerEvent>(this.document, 'pointerup').pipe(
        filter(() => this._dragging || this._resizing),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe((event: PointerEvent) => {
        this._dragging = false;
        this._resizing = false;
        this.pointerEndSubject.next(event);
      });
    });
  }

  public startDrag(item: Item, itemCom: ItemComponent): void {
    this._dragging = true;
  }

  public startResize(item: Item, resizeType: string): void {
    this._resizing = true;
  }
}

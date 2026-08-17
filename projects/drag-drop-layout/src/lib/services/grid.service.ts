import {DOCUMENT} from '@angular/common';
import {DestroyRef, Inject, Injectable, NgZone} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {auditTime, filter, fromEvent, merge, Observable, Subject, Subscription} from 'rxjs';
import {IPosition} from '../definitions';
import {GridInteractionAdapter, InteractionSession} from '../interaction/interaction.definitions';
import {GridItem, ResizeType} from '../item/item.definitions';
import {PlacementOperation} from '../layout/layout.definitions';
import {PlaceholderRenderer} from '../placeholder';
import {getScrollOffset} from '../util';
import {GridRegistry} from './grid-drag-item.service';

export interface PointerInteractionEvent {
  readonly event: IPosition;
  readonly scroll: IPosition;
}

type ActiveInteraction = {
  session: InteractionSession;
  scrollElement: HTMLElement | Document | null;
  dragOffset: IPosition;
  initialSize: {width: number; height: number};
  lastPointer: IPosition;
};

@Injectable({providedIn: 'root'})
export class GridService {
  public readonly pointerMove$: Observable<PointerInteractionEvent>;
  public readonly pointerEnd$: Observable<PointerInteractionEvent>;

  private readonly pointerMoveSubject = new Subject<PointerInteractionEvent>();
  private readonly pointerEndSubject = new Subject<PointerInteractionEvent>();
  private active: ActiveInteraction | null = null;
  private moveSubscription: Subscription | null = null;

  public constructor(
    private readonly destroyRef: DestroyRef,
    private readonly ngZone: NgZone,
    private readonly registry: GridRegistry,
    private readonly placeholder: PlaceholderRenderer,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {
    this.pointerMove$ = this.pointerMoveSubject.asObservable();
    this.pointerEnd$ = this.pointerEndSubject.asObservable();
    this.ngZone.runOutsideAngular(() => {
      merge(
        fromEvent<PointerEvent>(this.document, 'pointerup'),
        fromEvent<PointerEvent>(this.document, 'pointercancel'),
      ).pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((event) => this.active?.session.pointerId === event.pointerId),
      ).subscribe((event) => this.ngZone.run(() => this.finish({x: event.clientX, y: event.clientY})));
    });
  }

  public startGridDrag(
    source: GridInteractionAdapter,
    item: GridItem,
    element: HTMLElement,
    event: PointerEvent,
    itemOffset: IPosition,
    scrollElement: HTMLElement | Document | null,
  ): void {
    const targets = new Set([source.interactionGridId, ...source.interactionConnectedTo]);
    this.begin('move', source, item, element, event, itemOffset, targets, scrollElement);
  }

  public startPaletteDrag(
    item: GridItem,
    element: HTMLElement,
    event: PointerEvent,
    targets: readonly string[],
    scrollElement: HTMLElement | Document | null,
  ): void {
    this.begin('insert', null, item, element, event, {x: 0, y: 0}, new Set(targets), scrollElement);
  }

  public startResize(
    source: GridInteractionAdapter,
    item: GridItem,
    element: HTMLElement,
    event: PointerEvent,
    resizeType: ResizeType,
    scrollElement: HTMLElement | Document | null,
  ): void {
    const session = this.begin(
      'resize',
      source,
      item,
      element,
      event,
      {x: 0, y: 0},
      new Set([source.interactionGridId]),
      scrollElement,
    );
    session.resizeType = resizeType;
  }

  private begin(
    operation: PlacementOperation,
    source: GridInteractionAdapter | null,
    item: GridItem,
    element: HTMLElement,
    event: PointerEvent,
    itemOffset: IPosition,
    allowedTargets: ReadonlySet<string>,
    scrollElement: HTMLElement | Document | null,
  ): InteractionSession & {resizeType?: ResizeType} {
    if (this.active) {
      this.cancelActive('outside-grid');
    }
    const rect = element.getBoundingClientRect();
    const scroll = getScrollOffset(scrollElement);
    const sourceSnapshot = source?.snapshot() ?? null;
    const session: InteractionSession & {resizeType?: ResizeType} = {
      pointerId: event.pointerId,
      operation,
      sourceGridId: source?.interactionGridId ?? null,
      item,
      itemOffset,
      allowedTargets,
      sourceSnapshot,
      geometries: new Map(),
      snapshots: new Map(source && sourceSnapshot ? [[source.interactionGridId, sourceSnapshot]] : []),
      targetGridId: operation === 'resize' ? source!.interactionGridId : null,
      lastResult: null,
    };
    if (source) {
      session.geometries.set(source.interactionGridId, source.captureGeometry(scroll));
    }
    this.active = {
      session,
      scrollElement,
      dragOffset: {x: rect.left - event.clientX, y: rect.top - event.clientY},
      initialSize: {width: rect.width, height: rect.height},
      lastPointer: {x: event.clientX, y: event.clientY},
    };
    this.placeholder.show({
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    });
    this.registerMoveEvents(scrollElement);
    return session;
  }

  private registerMoveEvents(scrollElement: HTMLElement | Document | null): void {
    this.moveSubscription?.unsubscribe();
    this.ngZone.runOutsideAngular(() => {
      const pointerMoves = fromEvent<PointerEvent>(this.document, 'pointermove').pipe(
        auditTime(8),
        filter((event) => this.active?.session.pointerId === event.pointerId),
      );
      const events = scrollElement
        ? merge(pointerMoves, fromEvent(scrollElement, 'scroll').pipe(auditTime(8)))
        : pointerMoves;
      this.moveSubscription = events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        if (!this.active) return;
        if (event instanceof PointerEvent) {
          this.active.lastPointer = {x: event.clientX, y: event.clientY};
        }
        this.move(this.active.lastPointer);
      });
    });
  }

  private move(pointer: IPosition): void {
    if (!this.active) return;
    const active = this.active;
    const session = active.session;
    const scroll = getScrollOffset(active.scrollElement);
    this.pointerMoveSubject.next({event: pointer, scroll});

    if (session.operation !== 'resize') {
      this.placeholder.update({
        left: pointer.x + active.dragOffset.x + window.scrollX,
        top: pointer.y + active.dragOffset.y + window.scrollY,
        width: active.initialSize.width,
        height: active.initialSize.height,
      });
    }

    const hovered = session.operation === 'resize' ? null : this.registry.findAtPointer(pointer);
    const target = session.operation === 'resize'
      ? this.registry.get(session.sourceGridId!) ?? null
      : hovered && session.allowedTargets.has(hovered.interactionGridId) ? hovered : null;
    const previousTarget = session.targetGridId ? this.registry.get(session.targetGridId) : undefined;

    if (previousTarget && previousTarget !== target) {
      previousTarget.clearPreview(session.snapshots.get(previousTarget.interactionGridId));
    }
    session.targetGridId = target?.interactionGridId ?? null;

    const source = session.sourceGridId ? this.registry.get(session.sourceGridId) : undefined;
    if (source && target?.interactionGridId !== source.interactionGridId && session.sourceSnapshot) {
      source.previewSourceRemoval(session.item.id, session.sourceSnapshot);
    } else if (source && session.sourceSnapshot && target !== source) {
      source.clearPreview(session.sourceSnapshot);
    }

    if (!target) {
      session.lastResult = hovered
        ? {ok: false, reason: 'not-connected', attemptedItem: session.item}
        : null;
      return;
    }

    if (!session.snapshots.has(target.interactionGridId)) {
      session.snapshots.set(target.interactionGridId, target.snapshot());
    }
    if (!session.geometries.has(target.interactionGridId)) {
      session.geometries.set(target.interactionGridId, target.captureGeometry(scroll));
    }
    const preview = target.preview(session, session.snapshots.get(target.interactionGridId)!, pointer, scroll);
    session.lastResult = preview.result;
    if (preview.result.ok && preview.rect) {
      this.placeholder.update(preview.rect);
    }
  }

  private finish(pointer: IPosition): void {
    if (!this.active) return;
    this.move(pointer);
    const {session, scrollElement} = this.active;
    const target = session.targetGridId ? this.registry.get(session.targetGridId) : undefined;
    const source = session.sourceGridId ? this.registry.get(session.sourceGridId) : undefined;
    const result = session.lastResult;

    if (target && result?.ok) {
      target.commitPreview();
      if (source && source !== target) {
        source.commitSourceRemoval(session.item.id);
      }
      const committedItem = result.items.find((item) => item.id === session.item.id) ?? session.item;
      target.notifyPlacementCommitted({
        operation: source && source !== target ? 'transfer' : session.operation,
        item: committedItem,
        sourceGridId: session.sourceGridId,
        targetGridId: target.interactionGridId,
        items: result.items,
        rows: result.rows,
      });
    } else {
      target?.clearPreview(session.targetGridId ? session.snapshots.get(session.targetGridId) : undefined);
      source?.clearPreview(session.sourceSnapshot ?? undefined);
      (target ?? source)?.notifyPlacementRejected({
        operation: session.operation,
        reason: result && !result.ok ? result.reason : 'outside-grid',
        item: session.item,
        sourceGridId: session.sourceGridId,
        targetGridId: session.targetGridId,
      });
    }

    this.pointerEndSubject.next({event: pointer, scroll: getScrollOffset(scrollElement)});
    this.endSession();
  }

  private cancelActive(reason: 'outside-grid'): void {
    if (!this.active) return;
    const {session} = this.active;
    const source = session.sourceGridId ? this.registry.get(session.sourceGridId) : undefined;
    const target = session.targetGridId ? this.registry.get(session.targetGridId) : undefined;
    target?.clearPreview(session.targetGridId ? session.snapshots.get(session.targetGridId) : undefined);
    source?.clearPreview(session.sourceSnapshot ?? undefined);
    (target ?? source)?.notifyPlacementRejected({
      operation: session.operation,
      reason,
      item: session.item,
      sourceGridId: session.sourceGridId,
      targetGridId: session.targetGridId,
    });
    this.endSession();
  }

  private endSession(): void {
    this.placeholder.hide();
    this.moveSubscription?.unsubscribe();
    this.moveSubscription = null;
    this.active = null;
  }
}

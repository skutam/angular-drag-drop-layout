import {AfterContentInit, ContentChildren, DestroyRef, Directive, effect, input, QueryList} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DragItemDirective} from './drag-item.directive';

@Directive({selector: '[ddlDragItems]'})
export class DragItemsDirective implements AfterContentInit {
  @ContentChildren(DragItemDirective, {descendants: true}) private items!: QueryList<DragItemDirective>;

  public readonly targets = input<readonly string[]>([]);

  public constructor(private readonly destroyRef: DestroyRef) {
    effect(() => this.assignTargets(this.targets()));
  }

  public ngAfterContentInit(): void {
    this.items.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.assignTargets(this.targets()));
    this.assignTargets(this.targets());
  }

  private assignTargets(targets: readonly string[]): void {
    this.items?.forEach((item) => item.setTargets(targets));
  }
}

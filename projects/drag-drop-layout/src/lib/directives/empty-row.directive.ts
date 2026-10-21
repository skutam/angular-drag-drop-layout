import {Directive, inject, TemplateRef} from '@angular/core';

export interface EmptyRowContext {
  $implicit: number;
  row: number;
  canRemove: boolean;
  remove: () => boolean;
}

/** Optional, consumer-owned controls rendered over each committed empty row. */
@Directive({selector: 'ng-template[ddlEmptyRow]'})
export class EmptyRowDirective {
  public readonly template = inject<TemplateRef<EmptyRowContext>>(TemplateRef);

  public static ngTemplateContextGuard(_directive: EmptyRowDirective, context: unknown): context is EmptyRowContext {
    return true;
  }
}

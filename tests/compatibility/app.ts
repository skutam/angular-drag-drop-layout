import {Component, signal} from '@angular/core';
import {JsonPipe} from '@angular/common';
import {createGridItem, DragDropLayoutModule, GridItem, PlacementCommittedEvent, PlacementRejectedEvent} from '@skutam/drag-drop-layout';

@Component({
  selector: 'compat-app',
  imports: [DragDropLayoutModule, JsonPipe],
  templateUrl: './app.html',
})
export class CompatibilityApp {
  readonly itemsA = signal<readonly GridItem[]>([createGridItem({id: 'first', x: 1, y: 1, width: 1, height: 1})]);
  readonly itemsB = signal<readonly GridItem[]>([]);
  readonly rowsA = signal(2);
  readonly rowsB = signal(2);
  readonly events = signal<string[]>([]);
  readonly growth = signal(true);
  readonly document = document;

  record(change: string): void {
    this.events.update(events => [...events, change]);
  }

  committed(event: PlacementCommittedEvent): void {
    const target = event.targetGridId === 'a' ? this.itemsA() : this.itemsB();
    this.record(`commit:${event.operation}:${target.some(item => item.id === event.item.id)}`);
  }

  rejected(event: PlacementRejectedEvent): void {
    this.record(`reject:${event.reason}`);
  }

  replace(): void {
    this.itemsA.set([createGridItem({id: 'first', x: 4, y: 1, width: 1, height: 1})]);
  }

  fill(): void {
    this.growth.set(false);
    this.itemsA.set([createGridItem({id: 'first', x: 1, y: 1, width: 4, height: 2})]);
  }
}

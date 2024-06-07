import {ChangeDetectionStrategy, Component, effect, ElementRef, Inject, input, InputSignal} from '@angular/core';

@Component({
  selector: 'ddl-item',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item.component.html',
  styleUrl: './item.component.css',
})
export class ItemComponent {
  private static itemIdCounter: number = 0;
  public id: number = ItemComponent.itemIdCounter++;

  // Inputs
  public x = input(0);
  public y = input(0);
  public width = input(1);
  public height = input(1);

  public constructor(
    @Inject(ElementRef) private item: ElementRef<HTMLDivElement>,
  ) {
    this.registerPropertyEffect('--ddl-item-x', this.x);
    this.registerPropertyEffect('--ddl-item-y', this.y);
    this.registerPropertyEffect('--ddl-item-width', this.width);
    this.registerPropertyEffect('--ddl-item-height', this.height);
  }

  private registerPropertyEffect(property: string, signalValue: InputSignal<any>): void {
    effect(() => {
      this.item.nativeElement.style.setProperty(property, signalValue().toString());
    });
  }
}

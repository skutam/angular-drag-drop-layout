import {Component, ElementRef, Inject, Input, OnChanges} from '@angular/core';
import {Item} from "./item.definitions";

@Component({
  selector: 'ddl-item',
  standalone: true,
  imports: [],
  templateUrl: './item.component.html',
  styleUrl: './item.component.css',
})
export class ItemComponent implements Item, OnChanges {
  private static itemIdCounter: number = 0;
  public id: number = ItemComponent.itemIdCounter++;

  @Input() public x: number = 0;
  @Input() public y: number = 0;
  @Input() public width: number = 1;
  @Input() public height: number = 1;

  public constructor(
    @Inject(ElementRef) private item: ElementRef<HTMLDivElement>,
  ) { }

  public ngOnChanges(): void {
    this.updateItem();
  }

  private updateItem(): void {
    this.item.nativeElement.style.setProperty('--ddl-item-x', this.x.toString());
    this.item.nativeElement.style.setProperty('--ddl-item-y', this.y.toString());
    this.item.nativeElement.style.setProperty('--ddl-item-width', this.width.toString());
    this.item.nativeElement.style.setProperty('--ddl-item-height', this.height.toString());
  }
}

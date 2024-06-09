export function itemTrackBy(_: number, item: Item) {
  return item.id;
}

export interface ItemDragEvent {
  item: Item;
  event: PointerEvent;
}

export class Item {
  public id: string = '';
  public width: number = 1;
  public height: number = 1;
  public x: number = 0;
  public y: number = 0;

  public constructor(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
  }

  public clone(): Item {
    return new Item(this.id, this.x, this.y, this.width, this.height);
  }
}

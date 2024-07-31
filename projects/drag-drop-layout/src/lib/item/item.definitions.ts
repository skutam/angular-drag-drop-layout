export function itemTrackBy(_: number, item: Item) {
  return item.id;
}

export interface ItemDragEvent {
  item: Item;
  event: PointerEvent;
}

export type ResizeType = 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';
export type ResizeInfo = {
  top: boolean;
  left: boolean;
  bottom: boolean;
  right: boolean;
  vertical: boolean;
  horizontal: boolean;
}

export function getResizeInfo(type: ResizeType): ResizeInfo {
  return {
    top: type.includes('top'),
    left: type.includes('left'),
    bottom: type.includes('bottom'),
    right: type.includes('right'),
    vertical: type.includes('top') || type.includes('bottom'),
    horizontal: type.includes('left') || type.includes('right'),
  };
}

export interface ItemResizeEvent extends ItemDragEvent {
  resizeType: ResizeType;
}

export class Item {
  public id: string = '';
  public width: number = 1;
  public height: number = 1;
  public x: number = 0;
  public y: number = 0;
  public data: any = undefined;

  public constructor(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    data: any = undefined) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
    this.data = data;
  }

  public clone(): Item {
    return new Item(this.id, this.x, this.y, this.width, this.height, this.data);
  }
}

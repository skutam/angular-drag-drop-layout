import {Item} from "./item/item.definitions";

export class Placeholder {
  private readonly placeholder!: HTMLElement;
  private readonly item: Item = new Item('', 0, 0, 0, 0);

  constructor(private _document: Document) {
    this.placeholder = this._document.createElement('div');
    this.placeholder.style.backgroundColor = '#256';
    this.placeholder.style.position = 'absolute';
    this.placeholder.style.border = '1px dashed #000';
    this.placeholder.style.margin = '0';
    this.placeholder.style.padding = '0';
    this.placeholder.style.pointerEvents = 'none';
    this.placeholder.style.zIndex = '1000';
    this.placeholder.style.opacity = '0.0';
    this.placeholder.style.display = 'none';
    this._document.body.appendChild(this.placeholder);
  }

  protected createPlaceholder(width: number, height: number, x: number, y: number): void {
    this.placeholder.style.width = `${width}px`;
    this.placeholder.style.height = `${height}px`;
    this.placeholder.style.left = `${x}px`;
    this.placeholder.style.top = `${y}px`;
    this.placeholder.style.opacity = '0.60';
    this.placeholder.style.display = 'block';

    this.item.width = width;
    this.item.height = height;
    this.item.x = x;
    this.item.y = y;
  }

  public movePlaceholder(x: number, y: number): void {
    this.placeholder.style.left = `${x}px`;
    this.placeholder.style.top = `${y}px`;
  }

  public resizePlaceholder(width: number, height: number): void {
    this.placeholder.style.width = `${width}px`;
    this.placeholder.style.height = `${height}px`;
  }

  /**
   * Destroy the placeholder
   * Handled by the grid service
   */
  protected destroyPlaceholder(): void {
    this.placeholder.style.opacity = '0.0';
    this.placeholder.style.display = 'none';
    this.item.x = 0;
    this.item.y = 0;
    this.item.width = 0;
    this.item.height = 0;

    // Item still exists, but is not visible, make sure to reset it so it doesn't cause overflow issues
    this.movePlaceholder(0, 0);
    this.resizePlaceholder(0, 0);
  }

  public getItem(): Item {
    return this.item;
  }
}

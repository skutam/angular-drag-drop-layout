export class Placeholder {
  private readonly placeholder: HTMLElement;
  public width: number = 0;
  public height: number = 0;
  public x: number = 0;
  public y: number = 0;

  constructor(
    document: Document,
  ) {
    this.placeholder = document.createElement('div');
    this.placeholder.style.backgroundColor = '#256';
    this.placeholder.style.position = 'absolute';
    this.placeholder.style.border = '1px dashed #000';
    this.placeholder.style.margin = '0';
    this.placeholder.style.padding = '0';
    this.placeholder.style.pointerEvents = 'none';
    this.placeholder.style.zIndex = '1000';
    this.placeholder.style.opacity = '0.0';
    document.body.appendChild(this.placeholder);
  }

  public createPlaceholder(width: number, height: number, x: number, y: number): void {
    this.placeholder.style.width = `${width}px`;
    this.placeholder.style.height = `${height}px`;
    this.placeholder.style.left = `${x}px`;
    this.placeholder.style.top = `${y}px`;
    this.placeholder.style.opacity = '0.60';

    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
  }

  public movePlaceholder(x: number, y: number): void {
    this.placeholder.style.left = `${x}px`;
    this.placeholder.style.top = `${y}px`;
  }

  public resizePlaceholder(width: number, height: number): void {
    this.placeholder.style.width = `${width}px`;
    this.placeholder.style.height = `${height}px`;
  }

  public destroyPlaceholder(): void {
    this.placeholder.style.opacity = '0.0';
  }
}

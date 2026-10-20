import {DestroyRef, DOCUMENT, Inject, Injectable} from '@angular/core';
import {RenderedRect} from './geometry/grid-geometry';

@Injectable({providedIn: 'root'})
export class PlaceholderRenderer {
  private readonly element: HTMLElement;

  public constructor(@Inject(DOCUMENT) document: Document, destroyRef: DestroyRef) {
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      backgroundColor: '#256',
      position: 'absolute',
      border: '1px dashed #000',
      boxSizing: 'border-box',
      margin: '0',
      padding: '0',
      pointerEvents: 'none',
      zIndex: '1000',
      opacity: '0',
      display: 'none',
    });
    document.body.appendChild(this.element);
    destroyRef.onDestroy(() => this.element.remove());
  }

  public show(rect: RenderedRect): void {
    this.update(rect);
    this.element.style.opacity = '0.60';
    this.element.style.display = 'block';
  }

  public update(rect: RenderedRect): void {
    this.element.style.left = `${rect.left}px`;
    this.element.style.top = `${rect.top}px`;
    this.element.style.width = `${Math.max(1, rect.width)}px`;
    this.element.style.height = `${Math.max(1, rect.height)}px`;
  }

  public hide(): void {
    this.element.style.opacity = '0';
    this.element.style.display = 'none';
    this.update({left: 0, top: 0, width: 0, height: 0});
  }
}

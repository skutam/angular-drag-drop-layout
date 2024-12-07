import {IPosition} from "./definitions";

export function clamp(min: number, max: number, value: number): number {
  return Math.min(Math.max(value, min), max);
}


/**
 * Returns the scroll offset of the scrollable element
 */
export function getScrollOffset(scrollElement: HTMLElement | Document | null): IPosition {
  if (scrollElement === null) {
    return {
      x: 0,
      y: 0,
    };
  }

  const isDocument = scrollElement instanceof Document;
  return {
    x: isDocument ? window.scrollX : scrollElement.scrollLeft,
    y: isDocument ? window.scrollY : scrollElement.scrollTop,
  }
}

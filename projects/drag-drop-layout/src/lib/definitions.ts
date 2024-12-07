export type Unit = 'px' | 'em' | 'rem' | '%' | 'vh' | 'vw';
export type HeightUnit = `${number}${Unit}`;
export type HeightProp = 'auto' | 'max-content' | 'min-content' | 'fit-content' | 'stretch' | HeightUnit;
export interface IPosition {
  x: number;
  y: number;
}

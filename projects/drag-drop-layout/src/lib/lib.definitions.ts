export interface DimensionValue {
  value: number;
  unit: Unit;
}

export type Unit = 'px' | '%' | 'fr' | 'em' | 'rem';

export class DimensionValue {
  public value: number = 0;
  public unit: Unit = 'px';

  constructor(value: number, unit: Unit) {
    this.value = value;
    this.unit = unit;
  }

  public toString(): string {
    return `${this.value}${this.unit}`;
  }
}

export type Unit = 'px' | '%' | 'fr' | 'em' | 'rem';

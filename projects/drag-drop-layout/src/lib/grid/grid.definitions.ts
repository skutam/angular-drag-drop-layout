import {DimensionValue} from "../lib.definitions";

export interface Grid {
  columns: number;
  rows: number;
  colGap: DimensionValue;
  rowGap: DimensionValue;
}

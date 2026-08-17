import {Injectable} from '@angular/core';
import {IPosition} from '../definitions';
import {GridInteractionAdapter} from '../interaction/interaction.definitions';

@Injectable({providedIn: 'root'})
export class GridRegistry {
  private readonly grids = new Map<string, GridInteractionAdapter>();

  public register(grid: GridInteractionAdapter): void {
    if (this.grids.has(grid.interactionGridId)) {
      throw new Error(`Duplicate grid id: ${grid.interactionGridId}`);
    }
    this.grids.set(grid.interactionGridId, grid);
  }

  public unregister(gridId: string): void {
    this.grids.delete(gridId);
  }

  public get(gridId: string): GridInteractionAdapter | undefined {
    return this.grids.get(gridId);
  }

  public atPointer(pointer: IPosition, allowedTargets: ReadonlySet<string>): GridInteractionAdapter | null {
    const grid = this.findAtPointer(pointer);
    return grid && allowedTargets.has(grid.interactionGridId) ? grid : null;
  }

  public findAtPointer(pointer: IPosition): GridInteractionAdapter | null {
    return [...this.grids.values()].find((grid) => grid.containsPointer(pointer)) ?? null;
  }
}

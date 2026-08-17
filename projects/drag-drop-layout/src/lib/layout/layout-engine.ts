import {GridItem} from '../item/item.definitions';
import {
  LayoutSnapshot,
  MoveDirection,
  PlacementFailure,
  PlacementRequest,
  PlacementResult,
  PlacementSuccess,
} from './layout.definitions';

type MutableLayout<DATA> = {
  items: Map<string, GridItem<DATA>>;
  rows: number;
};

export class LayoutEngine {
  public resolvePlacement<DATA>(request: PlacementRequest<DATA>): PlacementResult<DATA> {
    const validation = this.validateRequest(request);
    if (validation) {
      return validation;
    }

    const order = request.items.filter((item) => item.id !== request.active.id).map((item) => item.id);
    const resultOrder = request.items.some((item) => item.id === request.active.id)
      ? request.items.map((item) => item.id)
      : [...order, request.active.id];
    const state: MutableLayout<DATA> = {
      items: new Map(request.items.filter((item) => item.id !== request.active.id).map((item) => [item.id, item])),
      rows: request.rows,
    };

    const activeBottom = bottom(request.active);
    if (activeBottom > state.rows) {
      if (!canGrow(request)) {
        return failure('out-of-bounds', request.active);
      }
      state.rows = activeBottom;
    }
    state.items.set(request.active.id, freezeItem(request.active));

    const resolved = this.clearCollisions(
      state,
      request.active.id,
      new Set([request.active.id]),
      order,
      request,
      new Set(),
    );

    const fixedActiveResult = resolved && !hasAnyOverlap(resolved.items)
      ? success(resolved, resultOrder)
      : null;
    const relocated = request.mayRelocateActive && canGrow(request)
      ? this.relocateActiveBelowLayout(request, resultOrder)
      : null;
    if (fixedActiveResult && relocated) {
      return relocated.rows < fixedActiveResult.rows ? relocated : fixedActiveResult;
    }
    if (fixedActiveResult) return fixedActiveResult;
    if (relocated) return relocated;

    return failure('no-space', request.active);
  }

  public normalize<DATA>(
    snapshot: LayoutSnapshot<DATA>,
    movePriority: readonly MoveDirection[],
    allowRowGrowth: boolean,
  ): PlacementResult<DATA> {
    const duplicate = findDuplicateId(snapshot.items);
    if (duplicate) {
      return failure('duplicate-item-id', duplicate);
    }

    let result: PlacementSuccess<DATA> = {ok: true, items: [], rows: snapshot.rows};
    for (const item of snapshot.items) {
      const next = this.resolvePlacement({
        ...snapshot,
        items: result.items,
        rows: result.rows,
        active: item,
        operation: 'normalize',
        movePriority,
        allowRowGrowth,
        mayRelocateActive: true,
      });
      if (!next.ok) {
        return next;
      }
      result = next;
    }
    return result;
  }

  private clearCollisions<DATA>(
    state: MutableLayout<DATA>,
    fixedId: string,
    locked: ReadonlySet<string>,
    stableOrder: readonly string[],
    request: PlacementRequest<DATA>,
    visited: Set<string>,
  ): MutableLayout<DATA> | null {
    const fixed = state.items.get(fixedId)!;
    const collisions = stableOrder
      .filter((id) => id !== fixedId)
      .map((id) => state.items.get(id))
      .filter((item): item is GridItem<DATA> => !!item && overlaps(fixed, item));

    if (collisions.length === 0) {
      return state;
    }

    let branch = cloneState(state);
    for (const blocker of collisions) {
      if (locked.has(blocker.id)) {
        return null;
      }
      const moved = this.moveBlocker(branch, blocker.id, fixedId, locked, stableOrder, request, visited);
      if (!moved) {
        return null;
      }
      branch = moved;
    }
    return branch;
  }

  private moveBlocker<DATA>(
    state: MutableLayout<DATA>,
    blockerId: string,
    obstacleId: string,
    locked: ReadonlySet<string>,
    stableOrder: readonly string[],
    request: PlacementRequest<DATA>,
    visited: Set<string>,
  ): MutableLayout<DATA> | null {
    const blocker = state.items.get(blockerId)!;
    const obstacle = state.items.get(obstacleId)!;

    for (const direction of request.movePriority) {
      const candidate = moveClearOf(blocker, obstacle, direction);
      if (!withinHorizontalBounds(candidate, request.columns) || candidate.y < 1) {
        continue;
      }

      const candidateBottom = bottom(candidate);
      if (candidateBottom > state.rows && (direction !== 'bottom' || !canGrow(request))) {
        continue;
      }

      const branch = cloneState(state);
      branch.items.set(blockerId, candidate);
      branch.rows = Math.max(branch.rows, candidateBottom);
      const signature = stateSignature(branch, blockerId, locked);
      if (visited.has(signature)) {
        continue;
      }

      const branchVisited = new Set(visited);
      branchVisited.add(signature);
      const nextLocked = new Set(locked);
      nextLocked.add(blockerId);
      const resolved = this.clearCollisions(
        branch,
        blockerId,
        nextLocked,
        stableOrder,
        request,
        branchVisited,
      );
      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  private relocateActiveBelowLayout<DATA>(
    request: PlacementRequest<DATA>,
    resultOrder: readonly string[],
  ): PlacementSuccess<DATA> | null {
    const baseItems = request.items.filter((item) => item.id !== request.active.id);
    const firstFreeRow = Math.max(request.rows + 1, ...baseItems.map((item) => bottom(item) + 1));
    const maxX = request.columns - request.active.width + 1;
    for (let y = request.rows + 1; y <= firstFreeRow; y++) {
      for (let x = 1; x <= maxX; x++) {
        const active = freezeItem({...request.active, x, y});
        if (baseItems.every((item) => !overlaps(active, item))) {
          const state: MutableLayout<DATA> = {
            items: new Map([...baseItems, active].map((item) => [item.id, item])),
            rows: bottom(active),
          };
          return success(state, resultOrder);
        }
      }
    }
    return null;
  }

  private validateRequest<DATA>(request: PlacementRequest<DATA>): PlacementFailure<DATA> | null {
    if (!Number.isInteger(request.columns) || request.columns < 1 || !Number.isInteger(request.rows) || request.rows < 1) {
      return failure('invalid-config', request.active);
    }
    if (!validPriority(request.movePriority)) {
      return failure('invalid-config', request.active);
    }
    const duplicate = findDuplicateId(request.items);
    if (duplicate && duplicate.id !== request.active.id) {
      return failure('duplicate-item-id', duplicate);
    }
    const invalid = [...request.items, request.active].find((item) => !validItem(item, request.columns));
    if (invalid) {
      return failure('invalid-item', invalid);
    }
    if (!withinHorizontalBounds(request.active, request.columns) || request.active.y < 1) {
      return failure('out-of-bounds', request.active);
    }
    return null;
  }
}

export function overlaps(a: GridItem, b: GridItem): boolean {
  return a.x <= right(b) && right(a) >= b.x && a.y <= bottom(b) && bottom(a) >= b.y;
}

export function validPriority(priority: readonly MoveDirection[]): boolean {
  return priority.length > 0 && new Set(priority).size === priority.length &&
    priority.every((direction) => ['top', 'left', 'right', 'bottom'].includes(direction));
}

export function validItem(item: GridItem, columns: number): boolean {
  return !!item.id && [item.x, item.y, item.width, item.height].every((value) => Number.isInteger(value) && value >= 1) &&
    item.width <= columns;
}

function moveClearOf<DATA>(item: GridItem<DATA>, obstacle: GridItem, direction: MoveDirection): GridItem<DATA> {
  switch (direction) {
    case 'top': return freezeItem({...item, y: obstacle.y - item.height});
    case 'left': return freezeItem({...item, x: obstacle.x - item.width});
    case 'right': return freezeItem({...item, x: right(obstacle) + 1});
    case 'bottom': return freezeItem({...item, y: bottom(obstacle) + 1});
  }
}

function canGrow(request: PlacementRequest): boolean {
  return request.allowRowGrowth && request.movePriority.includes('bottom');
}

function right(item: GridItem): number {
  return item.x + item.width - 1;
}

function bottom(item: GridItem): number {
  return item.y + item.height - 1;
}

function withinHorizontalBounds(item: GridItem, columns: number): boolean {
  return item.x >= 1 && right(item) <= columns;
}

function cloneState<DATA>(state: MutableLayout<DATA>): MutableLayout<DATA> {
  return {items: new Map(state.items), rows: state.rows};
}

function hasAnyOverlap(items: ReadonlyMap<string, GridItem>): boolean {
  const values = [...items.values()];
  return values.some((item, index) => values.slice(index + 1).some((other) => overlaps(item, other)));
}

function stateSignature<DATA>(state: MutableLayout<DATA>, movingId: string, locked: ReadonlySet<string>): string {
  return `${movingId}|${[...locked].sort().join(',')}|${[...state.items.values()]
    .map((item) => `${item.id}:${item.x}:${item.y}`)
    .sort()
    .join('|')}`;
}

function success<DATA>(state: MutableLayout<DATA>, order: readonly string[]): PlacementSuccess<DATA> {
  const items = order
    .map((id) => state.items.get(id))
    .filter((item): item is GridItem<DATA> => !!item)
    .map(freezeItem);
  return {ok: true, items, rows: state.rows};
}

function failure<DATA>(reason: PlacementFailure<DATA>['reason'], attemptedItem: GridItem<DATA>): PlacementFailure<DATA> {
  return {ok: false, reason, attemptedItem};
}

function freezeItem<DATA>(item: GridItem<DATA>): GridItem<DATA> {
  return Object.freeze({...item});
}

function findDuplicateId<DATA>(items: readonly GridItem<DATA>[]): GridItem<DATA> | null {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      return item;
    }
    ids.add(item.id);
  }
  return null;
}

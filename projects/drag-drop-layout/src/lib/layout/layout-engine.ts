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

type SearchBudget = {remaining: number; exhausted: boolean};

export class LayoutEngine {
  public constructor(private readonly maxExpansions = 4096) {}

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

    let exhausted = false;
    const occupiedArea = [...state.items.values()].reduce((area, item) => area + item.width * item.height, 0);
    const stages = canGrow(request) ? [false, true] : [false];
    for (const growth of stages) {
      if (!growth && (activeBottom > request.rows || occupiedArea > request.rows * request.columns)) continue;
      const budget: SearchBudget = {remaining: this.maxExpansions, exhausted: false};
      let best: MutableLayout<DATA> | null = null;
      let bestScore: readonly number[] | null = null;
      for (const resolved of this.clearCollisions(
        state, request.active.id, new Set([request.active.id]), resultOrder,
        {...request, allowRowGrowth: growth}, new Set(), budget,
      )) {
        // Intermediate branches may temporarily need more rows than the final layout.
        const final = {...resolved, rows: Math.max(request.rows, ...[...resolved.items.values()].map(bottom))};
        const score = scoreLayout(final, request, growth);
        if ((!bestScore || compareScore(score, bestScore) < 0) && !hasAnyOverlap(final.items)) {
          best = final;
          bestScore = score;
        }
      }
      if (best) return success(best, resultOrder);
      exhausted ||= budget.exhausted;
    }

    return failure(exhausted ? 'search-limit' : 'no-space', request.active);
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
      });
      if (!next.ok) {
        return next;
      }
      result = next;
    }
    return result;
  }

  private *clearCollisions<DATA>(
    state: MutableLayout<DATA>,
    fixedId: string,
    locked: ReadonlySet<string>,
    stableOrder: readonly string[],
    request: PlacementRequest<DATA>,
    visited: Set<string>,
    budget: SearchBudget,
  ): Generator<MutableLayout<DATA>> {
    const fixed = state.items.get(fixedId)!;
    let blocker: GridItem<DATA> | undefined;
    for (const id of stableOrder) {
      const item = state.items.get(id)!;
      if (id !== fixedId && overlaps(fixed, item)) {
        blocker = item;
        break;
      }
    }

    if (!blocker) {
      yield state;
      return;
    }

    if (locked.has(blocker.id)) {
      return;
    }
    yield* this.moveBlocker(state, blocker.id, fixedId, locked, stableOrder, request, visited, budget);
  }

  private *moveBlocker<DATA>(
    state: MutableLayout<DATA>,
    blockerId: string,
    obstacleId: string,
    locked: ReadonlySet<string>,
    stableOrder: readonly string[],
    request: PlacementRequest<DATA>,
    visited: Set<string>,
    budget: SearchBudget,
  ): Generator<MutableLayout<DATA>> {
    const blocker = state.items.get(blockerId)!;
    const obstacle = state.items.get(obstacleId)!;

    for (const direction of request.movePriority) {
      if (budget.remaining === 0) {
        budget.exhausted = true;
        return;
      }
      budget.remaining--;
      const candidate = moveClearOf(blocker, obstacle, direction);
      if (!withinHorizontalBounds(candidate, request.columns) || candidate.y < 1) {
        continue;
      }

      const candidateBottom = bottom(candidate);
      if (candidateBottom > state.rows && (direction !== 'bottom' || !canGrow(request))) {
        continue;
      }
      // Locked ancestors cannot move in this branch. Reject before cloning and
      // exploring unrelated blockers that happen to precede them in item order.
      if ([...locked].some((id) => overlaps(candidate, state.items.get(id)!))) continue;

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
      for (const clearedBlocker of this.clearCollisions(
        branch,
        blockerId,
        nextLocked,
        stableOrder,
        request,
        branchVisited,
        budget,
      )) {
        // Enumerate the continuation as well: a locally cheap cascade may make
        // clearing another blocker more expensive or impossible.
        yield* this.clearCollisions(
          clearedBlocker, obstacleId, locked, stableOrder, request, branchVisited, budget,
        );
      }
    }
  }

  private validateRequest<DATA>(request: PlacementRequest<DATA>): PlacementFailure<DATA> | null {
    if (!Number.isInteger(request.columns) || request.columns < 1 || !Number.isInteger(request.rows) || request.rows < 1) {
      return failure('invalid-config', request.active);
    }
    if (!validPriority(request.movePriority)) {
      return failure('invalid-config', request.active);
    }
    const duplicate = findDuplicateId(request.items);
    if (duplicate) {
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

function scoreLayout(state: MutableLayout<unknown>, request: PlacementRequest, growth: boolean): readonly number[] {
  let moved = 0;
  let distance = 0;
  for (const original of request.items) {
    if (original.id === request.active.id) continue;
    const final = state.items.get(original.id)!;
    const delta = Math.abs(final.x - original.x) + Math.abs(final.y - original.y);
    if (delta > 0) moved++;
    distance += delta;
  }
  return growth ? [state.rows - request.rows, moved, distance] : [moved, distance];
}

function compareScore(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function hasAnyOverlap(items: ReadonlyMap<string, GridItem>): boolean {
  const values = [...items.values()];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (overlaps(values[i], values[j])) return true;
    }
  }
  return false;
}

function stateSignature<DATA>(state: MutableLayout<DATA>, movingId: string, locked: ReadonlySet<string>): string {
  // Map insertion order is fixed for the whole request, including all clones.
  return JSON.stringify([movingId, state.rows, [...locked].sort(), [...state.items.values()]
    .map((item) => `${item.x}:${item.y}`)
  ]);
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

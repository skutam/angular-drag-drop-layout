# Architecture

The library separates layout policy, interaction ownership, rendered geometry, and Angular rendering so each source of complexity has one home.

## Modules

`layout/LayoutEngine` is pure. It enumerates complete directional cascades with cycle detection and a 4,096-expansion budget per stage. The existing-row stage ranks displaced count and total distance; the growth fallback ranks extra rows first. Stable traversal breaks equal-score ties. The active item stays locked. Normalization uses the same solver in input order.

`layout/prepareInsertion` is the pure palette-sizing policy. It finds the horizontal gap across the full item height, selects a width between insertion minimum and preferred width, or returns the preferred-size proposal for pushing. Insertion settings belong to the session, not persisted item data.

`services/GridService` owns one pointer transaction at a time. It captures source and target snapshots, applies previews, enforces explicit connections, and decides commit or rollback. It refers to grids only through `GridInteractionAdapter`. Cross-grid completion order is destination commit, source commit, session cleanup, pointer-end notification, placement notification.

`geometry/GridGeometry` converts viewport pointer positions and scroll deltas into grid proposals. A snapshot freezes column tracks, row tracks, gaps, grid origin, and initial scroll. Rows below the captured grid are extrapolated from the frozen final track. Placeholder rectangles are document-space values.

`PlaceholderRenderer` is a DOM adapter. It receives pixel rectangles and never uses grid items as pixel storage.

`services/GridRegistry` maps stable public grid IDs to internal adapters and performs hit testing. The coordinator enforces allowed targets. The registry does not track palette directives or layout state.

`GridComponent` is the Angular adapter. It owns public signal inputs/models/outputs, reacts to immutable model replacements, renders item components by stable ID, latches effective preview rows separately from committed required rows, and applies the vertical auto-height lock. It delegates collision policy and pointer ownership to the deeper modules.

## Interaction flow

1. An item or palette directive starts a pointer session.
2. The coordinator captures immutable grid and geometry snapshots.
3. The registry selects an explicitly allowed target.
4. Geometry converts pointer state to an active proposal. Palette insertion starts with the raw pointed cell, then chooses its width before width-dependent placement can clamp it.
5. The layout engine resolves a complete preview.
6. The grid renders blocker positions and effective rows; the placeholder renders the active rectangle.
7. Pointer release commits all models or restores all snapshots, captures the placement result, and clears the session, pending movement, and placeholder.
8. The coordinator emits pointer-end (which emits item or palette `dragEnd` / `resizeEnd`), then the captured placement result. Cleanup is complete before these callbacks run, so a callback can start another interaction without the old completion clearing it or ending its subscriptions.

## Extension seams

New placement policies belong behind the layout request/result contract. New input mechanisms should begin the same interaction session rather than duplicate transaction behavior. Alternative placeholder presentation belongs behind the rendered-rectangle adapter. Geometry changes must preserve the distinction between frozen hit-test geometry and post-preview rendering.

See [ADR 0001](adr/0001-transactional-layout-engine.md) for the governing decision.

The grid caches the last solver result by session, snapshot, snapped proposal, operation, and collision settings. Placeholder geometry is recalculated on cache hits to account for scrolling. Clearing or committing a preview discards the cache. See [ADR 0002](adr/0002-adaptive-insertion-and-displacement-scoring.md).

# Domain Context

Angular Drag Drop Layout manages immutable rectangular items on a one-based CSS grid.

## Vocabulary

- **Grid item**: A stable ID, position, span, and optional application data.
- **Active item**: The item currently being moved, resized, transferred, inserted, or normalized.
- **Proposal**: The active item's requested rectangle before collision resolution.
- **Blocker**: An existing item overlapping the proposal or another displaced blocker.
- **Reflow**: A deterministic, atomic set of blocker displacements.
- **Preview**: Rendered provisional state that does not emit model changes.
- **Commit**: The single transition that publishes resolved items and rows.
- **Rejection**: A failed transaction followed by complete snapshot restoration.
- **Effective rows**: Rows rendered during preview. They can be latched above committed rows to prevent hover feedback.
- **Palette candidate**: A temporary item created by `ddlDragItem`; its source is never consumed.
- **Preferred width**: Original palette width used to calculate every insertion preview.
- **Insertion minimum**: Smallest initial fitted width; it does not constrain later explicit resizing.

## Invariants

Items have unique IDs, positive integer coordinates and spans, and remain within the configured columns. Layouts never contain overlaps after commit. Existing rows are not removed automatically. Row growth requires both `allowRowGrowth` and `bottom` in `movePriority`.

Palette insertion chooses a width from the contiguous gap under the pointer, clear across the entire requested height. Fitting is the default; fixed sizing is optional. If the gap cannot fit above the insertion minimum, preferred width capped to target columns enters collision resolution. Existing items never automatically shrink during moves or transfers.

The active proposal is fixed after insertion sizing and for moves, transfers, resizes, and normalization. Complete cascades within existing rows are ranked by displaced item count and then total Manhattan distance from the original snapshot, excluding the active item. Direction order breaks ties; omitted directions remain forbidden. Default order is bottom, left, right, top.

Only when no existing-row result is found does the solver try growth, ranking additional rows before displacement count and distance. Each stage permits 4,096 candidate expansions. A bounded search can miss feasible arrangements; rejection distinguishes search-limit from an exhausted no-space search. Programmatic items are processed in order, with later items winning their requested position.

Grid item records and collections are immutable. Every membership, order, coordinate, span, ID, or data change requires a replacement array; changed item values also require replacement records. Same-reference array mutation is outside the contract.

Preview state is private. Successful transactions update models once, while rejection restores all involved grids. A transfer commits destination then source before emitting its event.

Columns are a signal model, like rows. A column change that cannot accommodate the proposed layout restores the last accepted columns, rows, and items and emits a normalization rejection. Narrowing columns does not implicitly reposition or resize items. Two-way column binding propagates rollback to the application.

Pointer cancellation, superseding interactions, and column changes affecting an active transaction cancel that transaction. Cancellation restores previews, discards palette candidates, and ends the pointer lifecycle without committing. A grid rejection uses the reason `cancelled` when a source or target grid exists.

Rendered preview rows may remain latched above required rows. They become committed rows only when the final resolved layout needs them. Successful drops retain at least the original committed count; cancellation restores the snapshot.

Move, transfer, and palette insertion offer one append position after the target snapshot's last row when growth is permitted. A narrow strip at the original bottom edge selects this position, which stays fixed for the entire interaction. Temporary preview rows do not become additional drop rows. Item spans and collision reflow may still require growth; explicit resizing can extend beyond the original rows.

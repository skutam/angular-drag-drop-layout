# ADR 0002: Adaptive insertion and displacement scoring

- Status: Accepted
- Date: 2026-10-14

## Context

The form builder preserves deliberately positioned widgets and gaps. First-success direction traversal can move several neighbors when another direction would move one. Full-width palette widgets also require unnecessary insert, resize, and move steps to occupy an empty half-row.

## Decision

Palette items default to fitting the local horizontal gap across their entire height, bounded by preferred width and insertion minimum. Fixed insertion is an explicit policy. Existing widget movement and transfers preserve dimensions. Choose insertion size before locking the active rectangle for collision resolution.

Compare complete displacement results against the original snapshot: moved item count, total Manhattan distance, then stable direction traversal. Search existing rows before permitting growth; growth prioritizes the fewest additional rows. Default preference is bottom, left, right, top. Omitted directions remain prohibited, and growth requires both permission and bottom displacement.

Each stage has 4,096 candidate expansions. Return the best complete result found; otherwise report search-limit when exploration was truncated. This bounds candidate exploration without claiming global optimality. Do not compact gaps, swap widgets, or persist insertion settings in item records.

Keep rendered row latching for stable hover behavior, but commit only final required rows, with the original committed count as the floor. Preserve immutable snapshots, atomic transfers, rollback, and completion ordering from ADR 0001.

## Consequences

The preview communicates the final initial size. Preferred width is reconsidered on each preview, and insertion minima are configured by widget type. Search order can affect results at the budget limit. The API changes directly; no legacy solver mode, old-data migration, or compatibility adapters are provided.

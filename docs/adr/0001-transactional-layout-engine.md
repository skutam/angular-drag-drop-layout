# ADR 0001: Pure layout resolution and transactional interactions

- Status: Accepted
- Date: 2026-08-17

## Context

Drag, resize, transfer, palette insertion, row growth, scrolling, and CSS auto-row sizing previously shared mutable component and service state. Eager model changes made preview rollback difficult, component references coupled grids together, and DOM measurements fed back into hit testing while a grid was growing.

## Decision

Use an immutable pure layout engine for every placement path. Keep pointer interactions in a transaction coordinator with per-grid source and target snapshots. Address grids by required stable IDs and explicit connection lists. Freeze geometry used for hit testing during an interaction and keep placeholder rendering as a pixel-only adapter.

The library is authoritative for successful `items` and `rows` model updates. Preview is internal, rejection restores the starting snapshot, and commit emits one notification after model changes. This is a clean v2 contract; legacy mutable `Item`, `IItem`, component-reference connections, `GridEvent`, and `itemDropped` are not retained.

## Consequences

Collision behavior is deterministic and testable without Angular. Multiple grids cannot share preview rows accidentally. Scroll and auto-height fixes are expressed as geometry invariants instead of timing patches. Consumers must provide grid and item IDs and use two-way model bindings when they want library commits reflected in application state.

# Roadmap Item Dependencies — Design

**Date:** 2026-06-20
**Status:** Approved (design)
**Scope:** Add the ability to declare dependencies between items within a single roadmap.

## Summary

Users can declare **visual-only** dependencies between items in a roadmap. A
dependency is a directed edge **predecessor → successor** ("the successor depends
on the predecessor"). Dependencies are purely informational: no item date is ever
read, changed, or constrained by a dependency. Edges render as arrows on the
timeline (predecessor's finish → successor's start). Users create and remove
dependencies in two ways: a "Depends on" picker in the item editor panel, and a
drag-to-link handle on timeline bars.

### Non-goals (explicitly out of scope)

- No scheduling/enforcement: dependencies never move or block dates.
- No "warn on violation" highlighting (an arrow pointing backwards in time is
  allowed and simply renders as-is).
- No cross-roadmap dependencies. Edges are within a single roadmap only.
- No typed dependency kinds (FS/SS/FF/SF). A single generic directed edge.
- No editable edge attributes (label, color). An edge has only its two endpoints.

## Semantics

- **Direction:** `predecessor → successor`. The successor depends on the
  predecessor. The arrow is drawn from the predecessor's right (finish) edge to
  the successor's left (start) edge — the universal Gantt convention.
- **Cardinality:** many-to-many. An item may have multiple predecessors and
  multiple successors.
- **Rejected at write time (enforced server-side, mirrored client-side for UX):**
  - self-links (`predecessorId === successorId`),
  - duplicates (an identical edge already exists),
  - cycles (the new edge would create a directed cycle). Cycles are nonsensical
    for visual-only edges and would render as confusing back-arrows; the graphs
    are small, so detection is cheap.

## Architecture

### Data model — `convex/schema.ts`

New table (separate table, matching the established `lanes`/`fields`/`milestones`
pattern so it flows through `loadRoadmapChildren`, `getBundle`,
`getPublicRoadmap`, snapshots, and duplication):

```ts
dependencies: defineTable({
  roadmapId: v.id("roadmaps"),
  userId: v.string(),
  predecessorId: v.id("items"),
  successorId: v.id("items"),
})
  .index("by_roadmap", ["roadmapId"])
  .index("by_predecessor", ["predecessorId"])
  .index("by_successor", ["successorId"]),
```

The `by_predecessor` / `by_successor` indexes exist for cascade-delete when an
item is removed.

### Backend — `convex/dependencies.ts` (new)

- `create({ roadmapId, predecessorId, successorId })`
  - `requireRoadmapOwner(ctx, roadmapId)`.
  - Verify both items exist and both belong to `roadmapId`.
  - Reject self-link, duplicate (query existing edges for the roadmap), and cycle
    (DFS over current edges plus the proposed one).
  - Insert the row with `userId`.
- `remove({ dependencyId })`
  - Load the row, `requireRoadmapOwner` on its `roadmapId`, delete.
- **Cascade delete:** `convex/items.ts` `remove` is extended to delete every
  dependency referencing the removed item, found via `by_predecessor` and
  `by_successor`.

### Pure logic — `src/lib/dependencies.ts` (new, primary test surface)

Framework-free module, the main unit-test target (per `src/lib/` convention):

- `wouldCreateCycle(edges, predId, succId): boolean` — directed-graph DFS used for
  client-side pre-validation. The server enforces the authoritative check; this
  gives immediate UX feedback before the mutation round-trips.
- `dependencyArrows(deps, itemRects): Arrow[]` — given each item's pixel rect
  `{ left, width, top, height }`, produce an elbow-connector path from the
  predecessor's right-center to the successor's left-center, plus the arrowhead
  position. Returns geometry only; rendering is the component's job. This is the
  meaty, fully-tested function.

Note on duplication: the cycle check is intentionally implemented twice — the
authoritative version in `convex/dependencies.ts` operating on `Doc` rows, and
the client pre-validation version in `src/lib/dependencies.ts`. This mirrors the
existing codebase pattern where field-value validation is done client-side in
`src/lib/fields.ts` while the server still validates independently. Convex
functions do not import from `src/`.

### Bundle & share

`convex/lib/bundle.ts#loadRoadmapChildren` gains a `dependencies` query
(`by_roadmap`) and returns it. Because both `roadmaps.getBundle` (authed) and
`sharing.getPublicRoadmap` (unauthenticated, read-only) call
`loadRoadmapChildren`, dependencies appear in both for free. The
`TimelineBundle` type (`src/components/timeline/TimelineView.tsx`) gains
`dependencies: Doc<"dependencies">[]`.

### Rendering — `TimelineView` + `DependencyLayer.tsx` (new)

`TimelineView` already computes lane vertical layout (`laneLayout`) and per-lane
first-fit packing (`packLanes`). It will assemble a global
`Map<Id<"items">, rect>` (where `rect = { left, width, top, height }`) from that
existing geometry and pass it to a new `<DependencyLayer>`:

- An absolutely-positioned SVG overlay over the lanes area, sized
  `axisWidth × totalHeight`, layered like the existing milestone/guide overlay.
- The layer is `pointer-events: none`; only the arrow `<path>` elements opt back
  in to pointer events so bar drag/resize is never blocked.
- Each arrow is an SVG `<path>` elbow connector with a `<marker>` arrowhead.
  Colors come from `--rm-*` CSS tokens.

### Creating & deleting dependencies (both paths)

1. **Item editor panel** (`src/components/panel/ItemEditorPanel.tsx`): a
   "Depends on" multi-select listing the roadmap's other items. The panel edits
   the *successor*; the selected items are its predecessors. Toggling an entry
   calls `dependencies.create` / `dependencies.remove`. Self (the current item)
   is excluded from the list; choices that would create a cycle are disabled or
   rejected with an inline message.
2. **Timeline drag-to-link** (`src/components/timeline/ItemBar.tsx`): a small
   link handle appears on hover, visually distinct from the existing left/right
   resize grips. Dragging it onto another bar creates an edge (drag source =
   predecessor, drop target = successor). `TimelineView` resolves the drop-target
   item by point-in-rect testing against the global rect map. Self/duplicate/
   cycle are rejected with a brief inline message.
3. **Delete on the timeline:** hovering an arrow highlights it and shows a small
   × affordance at the path midpoint; clicking it calls `dependencies.remove`.

All three editing affordances (picker writes, link handle, arrow ×) are gated on
the existing `editable` flag (`Boolean(onItemDatesChange)`), so the read-only
public share view renders arrows but exposes no editing.

### Export / import — `src/lib/roadmapIO.ts`

Add an optional `dependencies` array to `roadmapExportSchema`, referencing items
by **index** (mirroring how `items` reference lanes by `laneIndex`):

```ts
dependencies: z.array(z.object({
  predecessorIndex: z.number(),
  successorIndex: z.number(),
})).optional(),
```

Because the field is additive and optional, the export **stays `version: 1`** and
older exports (without the field) still import cleanly. `serializeRoadmap` builds
an item-index map (parallel to the existing lane-index map) and emits edges;
`parseImport` carries the array through unchanged for the importer to resolve.

### Snapshots / versioning — `convex/schema.ts` + `convex/lib/snapshot.ts`

Add an optional `dependencies` array (by index) to `roadmapSnapshotValidator`:

```ts
dependencies: v.optional(v.array(v.object({
  predecessorIndex: v.number(),
  successorIndex: v.number(),
}))),
```

- `snapshotRoadmap` serializes edges using an item-index map.
- `applySnapshot` rebuilds edges after items are inserted, using a new
  item-id map (parallel to the existing `laneIds` array) to translate indices to
  the freshly-created item ids.
- `io.replaceRoadmap` (JSON import) and `roadmapVersions.restore` round-trip
  dependencies automatically through `applySnapshot`. The field is optional so
  existing stored snapshots restore without error.

### Duplicate — `convex/roadmaps.ts`

`duplicate` gains an item-id map (parallel to the existing `laneIdMap`) and clones
each dependency row, translating `predecessorId`/`successorId` to the new items.

## Testing

- `src/lib/__tests__/dependencies.test.ts`
  - `wouldCreateCycle`: direct self-edge, two-node cycle, transitive cycle,
    non-cyclic additions.
  - `dependencyArrows`: same-lane edge, cross-lane edge, reversed-time edge
    (successor starts before predecessor finishes), multiple edges.
- `convex/dependencies.test.ts`
  - create success; ownership rejection; self-link rejection; duplicate
    rejection; cycle rejection; cross-roadmap item rejection.
  - cascade-delete: removing an item deletes edges referencing it (as
    predecessor and as successor).
- `src/lib/__tests__/roadmapIO.test.ts`
  - round-trip with dependencies; back-compat import of a payload without the
    `dependencies` field.

## Files touched

**New**
- `convex/dependencies.ts`
- `convex/dependencies.test.ts`
- `src/lib/dependencies.ts`
- `src/lib/__tests__/dependencies.test.ts`
- `src/components/timeline/DependencyLayer.tsx`

**Modified**
- `convex/schema.ts` — `dependencies` table + `roadmapSnapshotValidator` field
- `convex/lib/bundle.ts` — load dependencies
- `convex/lib/snapshot.ts` — snapshot/restore dependencies
- `convex/items.ts` — cascade-delete dependencies on item remove
- `convex/roadmaps.ts` — clone dependencies in `duplicate`
- `src/lib/roadmapIO.ts` — export/import dependencies by index
- `src/lib/__tests__/roadmapIO.test.ts` — round-trip + back-compat
- `src/components/timeline/TimelineView.tsx` — rect map + `DependencyLayer`
- `src/components/timeline/ItemBar.tsx` — link handle + link-drag gesture
- `src/components/panel/ItemEditorPanel.tsx` — "Depends on" picker
- `src/components/share/ReadOnlyRoadmap.tsx` — pass dependencies through (read-only)
- `src/routes/roadmaps/$id.tsx` — wire create/remove dependency mutations

## Key decisions

1. **Separate `dependencies` table** rather than an embedded array on `items` —
   matches existing child-table conventions and downstream traversal.
2. **Reject cycles** rather than allowing them, even though edges are visual-only.
3. **Arrow anchoring = finish → start** (predecessor right edge → successor left
   edge).
4. **Export/import and snapshot stay backward compatible** via an additive,
   optional `dependencies` field referencing items by index; no version bump.

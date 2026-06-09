# Roadmap Versioning — Design

**Date:** 2026-06-09
**Status:** Approved (brainstorming)

## Context

Editing a roadmap is destructive and easy to get wrong — especially the **"Edit JSON data"** flow,
which wipes and rebuilds the entire roadmap from pasted JSON via `io.replaceRoadmap`. There is no
way to undo a bad edit or recover the previous state. Users want **manual checkpoints**: named
snapshots they can save at meaningful moments and restore later, and a safety net so risky
operations (JSON import, and restoring itself) never leave the roadmap unrecoverable.

The app already has the core machinery: `serializeRoadmap` (`src/lib/roadmapIO.ts`) turns a bundle
into a versioned payload, and `io.replaceRoadmap` (`convex/io.ts`) restores a roadmap from exactly
that payload (delete children → patch roadmap → re-insert). Versioning is a thin table + UI on top
of this proven snapshot/restore path.

> **Naming:** the table is `roadmapVersions` and the Convex module is `convex/roadmapVersions.ts`
> (not a bare `versions`) so future per-entity version tables — e.g. diagram versions — get their
> own clearly-scoped names rather than colliding in the shared schema namespace.

## Decisions

- **Model:** Manual named checkpoints (not an automatic per-change undo log).
- **Safety net:** Every destructive action — JSON import **and** restore — first auto-saves the
  current state as an `auto` checkpoint, so no state is ever unrecoverable.
- **Retention:** Single hard cap of **25 versions total** (manual + auto), oldest pruned first.
  - *Accepted trade-off:* a burst of imports/restores can eventually prune an old **manual**
    checkpoint. Chosen for bounded storage and simplicity. Cap is a single tunable constant.
- **Implementation:** Approach 1 — full snapshot per version, reusing the existing
  serialize/replace machinery. (Approach 3, snapshot blobs in Convex file storage, is the scaling
  path **if** roadmaps ever approach the 1 MB document-size limit; out of scope for now.)

## Architecture

### Data model — new `roadmapVersions` table (`convex/schema.ts`)

```
roadmapVersions: defineTable({
  roadmapId: v.id("roadmaps"),
  userId:    v.string(),
  label:     v.string(),                          // "Q1 plan" / "Before JSON import" / "Before restore"
  kind:      v.union(v.literal("manual"), v.literal("auto")),
  snapshot:  roadmapSnapshotValidator,            // full bundle copy
}).index("by_roadmap", ["roadmapId"])
```

- `_creationTime` (automatic) is the timestamp — no separate `createdAt`.
- `snapshot` reuses the import payload validator. **Move** the validator currently inlined in
  `convex/io.ts` (`importPayloadValidator`) into `convex/schema.ts` as `roadmapSnapshotValidator`,
  and import it from both `io.ts` and the new code. Single source of truth.

### Shared helpers — new `convex/lib/snapshot.ts`

Extract the snapshot/restore logic so JSON import and versioning share one code path:

- `snapshotRoadmap(ctx, roadmapId)` → builds the snapshot payload from the current roadmap +
  children (server-side mirror of `serializeRoadmap`; reuse `loadRoadmapChildren` from
  `convex/lib/bundle.ts`).
- `applySnapshot(ctx, roadmapId, userId, snapshot)` → the delete-children + patch-roadmap +
  re-insert logic **currently inlined in `replaceRoadmap`** (`convex/io.ts:63-123`), moved here
  unchanged (including the lane-index remap and the "default lane when empty" fallback).
- `saveVersion(ctx, roadmapId, userId, label, kind)` → `snapshotRoadmap` + insert a `roadmapVersions`
  row + **prune to cap 25** (query `by_roadmap`, delete oldest by `_creationTime` until count ≤ 25).

### Backend functions — new `convex/roadmapVersions.ts`

- `list({ roadmapId })` **query** — `requireRoadmapOwner`; returns version **metadata only**
  (`_id`, `label`, `kind`, `_creationTime`), newest-first. Omits the heavy `snapshot` blob.
- `create({ roadmapId, label })` **mutation** — `saveVersion(..., "manual")`. Empty/blank label
  falls back to a default (e.g. `Version {n}`).
- `restore({ versionId })` **mutation** — load version, `requireRoadmapOwner` via its `roadmapId`;
  **first** `saveVersion(..., "auto", "Before restore")`, then `applySnapshot(version.snapshot)`.

### Wire existing JSON import into the same path (`convex/io.ts`)

`replaceRoadmap` gains a `saveVersion(..., "auto", "Before JSON import")` call **before** applying
the imported payload, then delegates the apply to the shared `applySnapshot`. This is what makes a
bad JSON edit recoverable.

`convex/roadmaps.getBundle` is **not** modified — versions load via `roadmapVersions.list` only when the
dialog opens.

## UX

- **Toolbar:** new **"Versions"** button in the editor toolbar (`src/routes/roadmaps/$id.tsx`,
  beside "Edit JSON data"), opening a `VersionManager` dialog (`versionsOpen` state, same pattern
  as the other managers).
- **`VersionManager` dialog** (`src/components/versions/VersionManager.tsx`) — `radix-ui` `Dialog`,
  styled like `LaneManager`/`FieldManager`:
  - **Top:** label input + **"Save current version"** button → `roadmapVersions.create`.
  - **List:** newest-first from `roadmapVersions.list`; each row shows the **label**, a **kind badge**
    (`Manual` solid vs `Auto` muted/outline), a **relative timestamp** (date-fns
    `formatDistanceToNow`), and a **Restore** button.
  - **Restore:** confirm prompt — "This replaces the current roadmap. A safety checkpoint of the
    current state will be saved first." → `roadmapVersions.restore`. The live bundle subscription updates
    the timeline/table in real time.
  - **Empty state:** "No versions yet. Save one to create a restore point."
- **Out of scope (YAGNI):** no manual delete button (cap-25 auto-prune bounds the list), no
  diff/compare view, no confirm-less restore.

## Testing

- **`convex/roadmapVersions.test.ts`** (`convex-test` pattern, `import.meta.glob("./**/*.ts")`):
  - `create` inserts a `manual` version capturing current state.
  - `restore` first creates an `auto` "Before restore" version, then reproduces the snapshot's
    lanes/items/fields/milestones (round-trip: snapshot → mutate → restore → equals original).
  - 25-cap prunes oldest-first.
  - `io.replaceRoadmap` leaves a "Before JSON import" `auto` version behind.
  - Ownership enforced (non-owner rejected).
- Existing `roadmapIO` / `io` tests still pass after the validator move and `replaceRoadmap`
  refactor.
- Gates: `npm run check`, `npx tsc --noEmit`, `npx convex dev --once` (regenerates `_generated`,
  typechecks `convex/`) all green.

## Files

**New:** `convex/roadmapVersions.ts`, `convex/lib/snapshot.ts`, `convex/roadmapVersions.test.ts`,
`src/components/versions/VersionManager.tsx`.
**Modified:** `convex/schema.ts` (add `roadmapVersions` table + `roadmapSnapshotValidator`), `convex/io.ts`
(move validator out, auto-checkpoint, delegate to `applySnapshot`), `src/routes/roadmaps/$id.tsx`
(Versions button + dialog wiring).

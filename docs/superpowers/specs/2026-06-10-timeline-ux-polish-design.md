# Timeline UX polish — design

**Date:** 2026-06-10
**Status:** Approved for planning

A batch of seven UX refinements to the roadmap timeline editor and the public
share view. Each item is independent; they share a small set of new pure helpers
in `src/lib/timeline.ts` and one new per-roadmap setting (`barColorMode`).

## Goals

1. Drag snapping that feels predictable, with live feedback.
2. The year is always discoverable on the X axis.
3. The editor header is consistent between timeline and table views.
4. Lanes and items can be added directly from the timeline.
5. A roadmap can optionally color the whole bar instead of just the left line.
6. Milestone names are visible on the timeline.
7. The share view reads as read-only and wastes less horizontal space.

## Non-goals

- Drag-to-draw item creation (explicitly deferred in favor of click/double-click).
- A user-facing density toggle (column width is tuned per zoom, not exposed).
- Changing stored date precision (items remain day-precision).

## Shared foundation

### New pure helpers in `src/lib/timeline.ts`

These are framework-free and are the primary test surface.

- `snapGranularity(zoom): "day" | "week" | "month"`
  - `week → "day"`, `month → "week"`, `quarter → "month"`, `half → "month"`.
- `snapDate(date, granularity, edge)` — generalized from the current zoom-based
  signature to take a `"day" | "week" | "month"` granularity. `edge: "start"`
  snaps to the start of the unit, `"end"` to the end. Day granularity uses
  `startOfDay` / `endOfDay`.
- `yearBands(periods): { label: string; columnSpan: number }[]` — groups
  consecutive periods sharing `getYear(period.start)` into spans, in order.
- `columnWidth(zoom): number` — zoom-aware column width replacing the fixed
  `COLUMN_WIDTH = 140`. Starting values (tune during implementation):
  `week 104`, `month 116`, `quarter 96`, `half 96`. `LABEL_WIDTH` stays constant.

`resolveDrag` derives its granularity from `snapGranularity(zoom)` instead of
snapping to the whole zoom unit.

### Schema / persistence: `barColorMode`

Add an optional discriminated value `barColorMode: "left" | "fill"` to the
`roadmaps` table. Absent / `undefined` is treated as `"left"` (back-compat; no
migration needed).

Thread it through every place a roadmap is read, written, snapshotted, or
serialized:

- `convex/schema.ts` — add to the `roadmaps` table **and** to
  `roadmapSnapshotValidator`.
- `convex/roadmaps.ts` — accept `barColorMode` in the `update` mutation args.
- `convex/lib/snapshot.ts` — include `barColorMode` when building a snapshot and
  when restoring one.
- `src/lib/roadmapIO.ts` — include `barColorMode` in `serializeRoadmap` /
  `parseImport` so JSON export/import round-trips it.

After editing `convex/`, run `npx convex dev --once` to regenerate
`convex/_generated` and typecheck.

## Feature designs

### 1. Snapping — adaptive grid + live preview + guide line

**Behavior:** while dragging or resizing, the bar snaps in increments of
`snapGranularity(zoom)` and renders **at the snapped position** during the
gesture (today it follows the cursor pixel-for-pixel and only snaps on release,
which causes the "jumps to an unexpected place" feeling). A thin, full-height
vertical guide line is drawn at the edge being moved.

**Structure:** `TimelineView` owns a transient drag-preview state.

- `ItemBar` emits `onDragMove(mode, deltaX, clientY)` on pointer-move (in
  addition to the existing commit on pointer-up).
- `TimelineView` computes `resolveDrag(...)` from the live delta to get snapped
  dates, converts them to geometry, and positions the dragged bar there. It
  renders the guide line in the same absolutely-positioned overlay layer that
  already hosts milestone markers (so it spans the full lane stack).
- Commit on pointer-up is unchanged: `onItemDatesChange(itemId, start, end,
  laneId?)`.

`TimelineView` stays read-only when no `onItemDatesChange` is passed (share
view), so no preview/guide there.

**Tests:** `snapGranularity` mapping; `snapDate` at day and week granularity for
both edges; `resolveDrag` producing adaptive-grid results per zoom.

### 2. X-axis year band

`TimeAxis` becomes two-tier:

- A **sticky year row** above the period labels. Each cell spans
  `columnSpan × columnWidth(zoom)` from `yearBands(periods)` and shows the year.
- The existing period-label row sits below it.
- The column divider at each year boundary is drawn heavier than the normal
  inter-column rule so the transition is obvious even mid-scroll.

`buildPeriods` half labels change from `"H1 2025"` / `"H2 2025"` to `"H1"` /
`"H2"` — the year now lives in the band. (Quarter labels stay `"Q1"`, month
`"MMM"`, week `"W12"`.)

**Tests:** `yearBands` grouping across a year boundary; the half-label change.

### 3. Toolbar consistency

In `src/routes/roadmaps/$id.tsx`, restructure the header into a **title row** and
a separate **controls row** (view toggle, zoom switch, manager buttons, New
item). The controls row no longer competes with the title via
`justify-between`, so it does not reflow when the zoom switch appears/disappears
on view switch. Layout-only; no data changes.

### 4. Inline add

**Lanes:** render an `+ Add lane` row beneath the last lane in the lane-label
column. Clicking it reveals an inline text input; on Enter or blur with a
non-empty value it calls `api.lanes.create` with the typed name (no throwaway
default name). Escape / empty cancels.

**Items:**

- A `+` button revealed on hover in each `LaneRow` label cell. Clicking opens
  `ItemEditorPanel` preset to that lane.
- Double-clicking empty canvas inside a lane opens the panel preset to that lane
  **and** the date under the cursor (`xToDate(localX, windowStart, windowEnd,
  axisWidth)`). `LaneRow` receives `windowStart` / `windowEnd` for this.

**Wiring:** replace the editor's `editing: "new" | Id<"items"> | null` state with
a preset-aware shape (e.g. `{ kind: "new"; laneId?; startMs? } | Id<"items"> |
null`). `ItemEditorPanel` gains optional `presetLaneId` and `presetStartMs`;
`draftFromItem` uses them for the new-item branch (falling back to today's
behavior: `lanes[0]`, `windowStart`, `+30 days`).

**Tests:** light. Any extracted helper for default new-item dates gets a unit
test; the interactions themselves are covered by a cheap component test where
practical.

### 5. Solid bar fill (opt-in per roadmap)

`RoadmapSettingsDialog` gains a "Bar color style" control with options
**Left line** (default) and **Fill**, writing `barColorMode` via
`roadmaps.update`.

`ItemBar` takes a `colorMode: "left" | "fill"` prop (threaded
`TimelineView → LaneRow → ItemBar`):

- `"left"` — current rendering (white bg, 4px colored left border).
- `"fill"` — background is the resolved field color; text color is chosen by a
  luminance helper so the title stays legible on any user-picked color.

Add `readableTextOn(hex: string): string` to `src/lib/roadmapColors.ts`
(returns a dark or light token based on relative luminance). When the resolved
color is the neutral fallback, fill renders as a light gray with dark text.

**Tests:** `readableTextOn` returns dark for light colors and light for dark
colors, including the fallback.

### 6. Milestone name on hover/click popover

The marker stays minimal (line + dot) so adjacent milestones never produce
overlapping text. The name surfaces in a popover instead:

- **Hover** the dot → a popover shows `milestone.name` (and its date). It
  dismisses on pointer-leave.
- **Click** the dot → the popover is **pinned** and stays in view until it is
  dismissed (clicking the dot again, clicking outside, or Escape). This lets a
  user keep one or more names visible without cluttering the axis.

Implementation notes:

- The overlay layer hosting milestones is `pointer-events-none`; the dot
  (and only the dot) opts back in with `pointer-events: auto` so it is
  hoverable/clickable.
- Use `radix-ui` for the popover. A controlled `Popover` whose `open` is driven
  by hover (pointer-enter/leave) and latched by click ("pinned") satisfies both
  behaviors; the plan may instead pair a `Tooltip` (hover) with a controlled
  `Popover` (pinned) if that proves cleaner.
- The popover content sits above item bars (z-index) and may overflow its
  column horizontally. The `title` attribute can be dropped now that there is a
  real popover.

### 7. Share view

- **Cursor:** in `ItemBar`, use `cursor: grab` only when editable; otherwise
  `cursor: default`. Removes the misleading "draggable hand" in the read-only
  share view and drops the `active:grabbing` state there.
- **Column width:** handled by the zoom-aware `columnWidth(zoom)` from the shared
  foundation, which applies to both the editor and `ReadOnlyRoadmap`. Horizontal
  scroll for long ranges remains (expected); columns are simply narrower.

## Files touched

| File | Change |
|------|--------|
| `convex/schema.ts` | `barColorMode` on `roadmaps` + snapshot validator |
| `convex/roadmaps.ts` | `update` accepts `barColorMode` |
| `convex/lib/snapshot.ts` | snapshot/restore carry `barColorMode` |
| `src/lib/roadmapIO.ts` | JSON round-trip `barColorMode` |
| `src/lib/timeline.ts` | `snapGranularity`, generalized `snapDate`, `yearBands`, `columnWidth`, adaptive `resolveDrag`, half-label change |
| `src/lib/roadmapColors.ts` | `readableTextOn` |
| `src/components/timeline/TimeAxis.tsx` | two-tier year band, zoom-aware width |
| `src/components/timeline/TimelineView.tsx` | drag preview + guide overlay, zoom-aware width, pass `barColorMode`, add-lane row, add-item wiring, pass window to `LaneRow` |
| `src/components/timeline/LaneRow.tsx` | hover `+`, double-click add, window props |
| `src/components/timeline/ItemBar.tsx` | `colorMode` fill, `onDragMove`, cursor fix |
| `src/components/timeline/MilestoneMarker.tsx` | hover/click name popover |
| `src/components/roadmaps/RoadmapSettingsDialog.tsx` | bar color style control |
| `src/components/panel/ItemEditorPanel.tsx` | `presetLaneId` / `presetStartMs` |
| `src/routes/roadmaps/$id.tsx` | header restructure, preset-aware new-item state, wire add lane/item |
| `src/components/share/ReadOnlyRoadmap.tsx` | inherits narrower columns; header alignment if needed |

## Verification

- `npm run test` — unit tests above.
- `npm run check` — Biome (tabs, double quotes).
- `npx tsc --noEmit` — type check.
- `npx convex dev --once` — deploy backend + regenerate `_generated` after the
  schema change.
- `npm run build` — compile smoke test.

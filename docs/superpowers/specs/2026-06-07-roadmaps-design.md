# Roadmaps — Design Spec

**Date:** 2026-06-07
**Status:** Approved (design phase)

A web app for creating, editing, and sharing product/project roadmaps: timelines of
initiatives plotted across lanes and timeframes, with per-roadmap custom fields, a sortable
table view, milestones, real-time updates, and read-only share links.

The tech stack is fixed (see `roadmaps.md`): React 19 + TanStack React Start (SSR), TanStack
Router, Convex, Clerk, Cloudflare Workers, Tailwind v4 + CVA, Base UI/shadcn, TanStack Form +
Zod, date-fns, Lucide, Biome, Vitest. The app is already scaffolded with this stack.

---

## 1. Decisions locked in brainstorming

| Topic | Decision |
| --- | --- |
| Collaboration | **Owner edits + read-only share links.** Each roadmap has one owner. Real-time syncs the owner's own sessions. Others get a view-only link. No member/role system in MVP. |
| Editing UX | **Form-based editing + drag/resize.** Side-panel form for all fields; drag an item bar to reschedule, drag an edge to resize. |
| Time model | **Day-precision timestamps**, snap-to-view-unit on drag. |
| Zoom levels | **Week, Month, Quarter, Half-year.** Month is the default. |
| Customization | **Full custom fields per roadmap** (text / number / date / select / multiselect). Select fields carry colored options. Status seeded by default. Includes inline expandable long-description row. |
| MVP surfaces | Core timeline (lanes, items, drag/resize), custom fields, **milestones**, **sortable table view**, **filtering**, **import/export JSON**, real-time. |
| Deferred (Later) | Item **dependencies** + arrows, member/role sharing, comments, image/PDF/CSV export, Recharts reporting, roadmap templates. |
| Custom-field storage | **Approach A — embedded `values` map on each item.** Field defs in a `fields` table; values validated app-side (Zod) against those defs. |
| Lane delete | Items move to another lane; a roadmap always keeps one undeletable **default lane**. |
| Editor layout | **B — tabbed Timeline/Table views, full-width, with a slide-over item editor.** |
| Visual identity | **Adopt + refine** the mockup's design language (oklch palette, mono uppercase labels, green accent, 8px radius). **Light + dark** themes. |
| App name | **Roadmaps**. |

---

## 2. Architecture

Single codebase, two layers (mirrors the workouts app):

- **`src/`** — React 19 frontend, TanStack React Start (SSR), file-based routing.
- **`convex/`** — serverless backend: schema, queries, mutations.

Data flow: `Clerk (auth) → JWT → Convex → real-time subscriptions → React`. Every Convex
function enforces auth server-side except the single public share-token read path. Deployed as a
Cloudflare Worker.

**Isolation principle:** the date↔pixel math and the dynamic-Zod field logic live in pure,
framework-free modules (`src/lib/timeline.ts`, `src/lib/fields.ts`) so they are unit-testable and
reused across the timeline, table, editor, and filters from one source of truth.

---

## 3. Data model (`convex/schema.ts`)

All timestamps are epoch milliseconds.

### `roadmaps`
- `userId` (Clerk subject), `name`, `description?`
- `startDate`, `endDate` — the timeframe window
- `defaultZoom`: `"week" | "month" | "quarter" | "half"`
- `colorByFieldKey?` — which select field tints the item bars (defaults to `"status"`)
- `visibility`: `"private" | "link"`
- `shareToken?` — random token minted when link-sharing is enabled
- `archived`: boolean
- Indexes: `by_user` (`userId`), `by_user_archived` (`userId`, `archived`), `by_shareToken` (`shareToken`)

### `fields` — custom field definitions (one row per field per roadmap)
- `roadmapId`, `userId`
- `key` (stable machine key, e.g. `"status"`), `label`
- `type`: `"text" | "number" | "date" | "select" | "multiselect"`
- `options?`: array of `{ id: string, label: string, color: string }` (select/multiselect)
- `order`: number, `showInTable`: boolean, `isSystem?`: boolean (the seeded Status field — editable, not deletable)
- Index: `by_roadmap` (`roadmapId`)

### `lanes` — swimlane rows (structural)
- `roadmapId`, `userId`, `name`, `color?`, `order`
- `isDefault?`: boolean (the undeletable default lane)
- Index: `by_roadmap`

### `items` — bars on the timeline
- `roadmapId`, `laneId`, `userId`
- `title`, `startDate`, `endDate` (day-precision)
- `description?` (inline-expandable long text)
- `values`: record keyed by field `key` → `string | number | string[] | null`
- `order`: number (stacking tie-break within a lane)
- Indexes: `by_roadmap`, `by_roadmap_lane` (`roadmapId`, `laneId`)

### `milestones` — point-in-time markers, roadmap-wide
- `roadmapId`, `userId`, `name`, `date`, `color?`
- Index: `by_roadmap`

**Not in MVP schema** (Later): `dependencies`, `comments`. The brief's `tags` table is replaced
by a `multiselect` custom field.

**Validation:** `values` is stored loosely in Convex (`v.record` of a small union). On every
write, the app validates `values` with a Zod schema **built dynamically from that roadmap's field
definitions** (`src/lib/fields.ts`): a `select` value must be a known option id, a `number` field
must be numeric, required vs optional honored, etc.

---

## 4. Convex API layer

One file per domain. Every function calls `ctx.auth.getUserIdentity()`; every write re-verifies the
parent roadmap's `userId` matches the caller before touching child rows. The sole exception is the
public share read path.

- **`roadmaps.ts`** — `list`, `get`, `getBundle`, `create` (seeds default Status field + default lane),
  `update`, `archive`, `duplicate` (clones fields + lanes + items), `enableShare` / `disableShare`.
- **`fields.ts`** — `create`, `update`, `reorder`, `remove` (blocked for `isSystem`; strips the key
  from every item's `values` on removal).
- **`lanes.ts`** — `create`, `update`, `reorder`, `remove` (refuses the last/default lane; moves the
  lane's items to a target lane).
- **`items.ts`** — `create`, `update` (single partial-patch mutation covering field-value edits,
  drag→dates, resize, lane move, reorder), `remove`.
- **`milestones.ts`** — `create`, `update`, `remove`.
- **`sharing.ts`** — `getPublicRoadmap({ shareToken })`: **public** query (no auth) returning the full
  bundle only if `visibility === "link"` and the token matches. The one unauthenticated read path.
- **`seed.ts`** — sample roadmap for new accounts / demos.

**Bundled reads:** `roadmaps.getBundle({ roadmapId })` returns roadmap + fields + lanes + items +
milestones in one query, so the editor subscribes to a single real-time query with atomic
snapshots. `getPublicRoadmap` returns the same shape for the share view.

**Import/Export:** export serializes a roadmap's bundle to JSON; import validates the JSON against
the field defs and creates a new roadmap (used for backup/seed and the per-application workflow).

---

## 5. Routing & components

### Routes (`src/routes/`)
- `__root.tsx` — providers (Clerk → Convex → Query), theme init
- `index.tsx` — landing
- `dashboard/index.tsx` — roadmap library (cards: create, duplicate, archive) — auth-gated
- `roadmaps/$id.tsx` — the editor (Timeline/Table tabs + slide-over editor) — auth-gated, owner only
- `share/$token.tsx` — **public** read-only roadmap view (no auth)
- `login/index.tsx`, `profile/index.tsx`

### Components (`src/components/`)
- **Shell:** `AppShell.tsx`, `Sidebar.tsx`, `BottomTabBar.tsx`
- **roadmaps/**: `RoadmapCard.tsx`, `CreateRoadmapDialog.tsx`
- **timeline/**: `TimelineView.tsx`, `TimeAxis.tsx`, `LaneRow.tsx`, `ItemBar.tsx` (draggable/resizable),
  `MilestoneMarker.tsx`, `ItemDetailRow.tsx` (inline-expandable description)
- **table/**: `ItemTable.tsx` (sortable; columns driven by `fields` where `showInTable`), `TableToolbar.tsx`
- **fields/**: `FieldManager.tsx` (define/reorder fields + options), `FieldValueInput.tsx` (renders the
  correct input per field type — shared by panel, table inline-edit, filters)
- **panel/**: `ItemEditorPanel.tsx` (slide-over; TanStack Form + Zod, fields rendered dynamically)
- **filters/**: `FilterBar.tsx` (lane, select-field value, text search)
- **share/**: `ShareReadOnly.tsx`, `ShareDialog.tsx`
- **ui/**: Base UI / shadcn primitives (scaffolded)

### Shared logic modules
- **`src/lib/timeline.ts`** — pure date↔pixel math (see §6).
- **`src/lib/fields.ts`** — builds a Zod schema from a roadmap's field definitions; the single source
  of truth for the editor form, table inline edits, filter inputs, and write validation.

The editor (`roadmaps/$id.tsx`) has two full-width tabs — **Timeline** and **Table** — and a
slide-over `ItemEditorPanel` that opens when an item is selected (a full-height bottom sheet on
mobile). `FieldValueInput` + the dynamic-Zod builder are the backbone that make custom fields work
identically across all surfaces.

---

## 6. Timeline mechanics

**Continuous positioning** (not column-snapped). The roadmap window `[startDate, endDate]` maps
linearly to the axis width:

```
left  = ((item.startDate − windowStart) / (windowEnd − windowStart)) × axisWidth
width = ((item.endDate − item.startDate) / (windowEnd − windowStart)) × axisWidth
```

The zoom level controls only the gridlines/labels behind the bars. The axis has a `min-width` and
scrolls horizontally; the lane-label column is sticky.

**Pure functions in `src/lib/timeline.ts`** (Vitest-covered):
- `buildPeriods(windowStart, windowEnd, zoom)` → `[{ start, end, label }]` (date-fns interval helpers)
- `dateToX` / `xToDate` — fraction math, both directions
- `snapDate(date, zoom, edge)` — snaps a dragged date to the active unit boundary (`startOf*`;
  `edge:"end"` snaps to the unit's end)
- `packLanes(items)` → sub-row assignment (first-fit; overlapping items stack, lane height grows)

**Drag & resize** (`ItemBar`, pointer events): drag body moves both dates; edge drag resizes one.
During the gesture only local state updates (smooth, no DB churn); on pointer-up, `snapDate` runs
and one `items.update` fires. Last-write-wins is sufficient since only the owner edits. Keyboard:
a selected bar nudges ±1 unit with arrow keys (accessibility).

**Real-time:** the editor subscribes to `getBundle`; any mutation pushes a fresh atomic snapshot to
all the owner's sessions and to share viewers. Optimistic local state covers only the in-flight drag.

---

## 7. Visual design

Adopt-and-refine the mockup's language, expressed as Tailwind v4 theme tokens (CSS variables):
- oklch palette, `--accent` green, 8px radius, mono uppercase micro-labels, generous borders.
- Status/priority/label chips colored from each select field's option colors.
- Refinements over the mockup: the slide-over editor (replacing the always-on right panel), field
  color chips, and the Timeline/Table tab switch.
- **Light + dark** themes via CSS variables, wired to the existing `ThemeToggle`.

---

## 8. Testing & quality

Vitest focused where logic is non-trivial:
- **`src/lib/timeline.ts`** — `buildPeriods` per zoom (boundary/leap cases), `dateToX`/`xToDate`
  round-trips, `snapDate` per zoom & edge, `packLanes` overlap stacking. Highest-value surface.
- **`src/lib/fields.ts`** — dynamic Zod builder: `select` rejects unknown option ids, `number`
  rejects non-numeric, required/optional, field removal strips values.
- **Convex auth/ownership** (`convex-test`) — mutations reject non-owners; `getPublicRoadmap`
  returns nothing for `private` or wrong token.
- **Components** — minimal smoke tests (`ItemBar` drag→update, dynamic form), since logic lives in
  the pure modules.

Biome for lint/format (tabs, double quotes); `routeTree.gen.ts` and `styles.css` excluded. Tests
run before any task is marked complete.

---

## 9. Suggested build order

1. Replace scaffold demo routes/components; wire Clerk + Convex providers; confirm an authed query
   round-trips.
2. `convex/schema.ts` (roadmaps → fields → lanes → items → milestones).
3. `roadmaps.ts` + `fields.ts` + `lanes.ts` + `items.ts` with auth + ownership checks; `getBundle`.
4. Dashboard (library) + create/duplicate/archive.
5. `src/lib/timeline.ts` + tests; read-only Timeline view (axis, lanes, item bars, milestones).
6. `src/lib/fields.ts` + tests; `FieldValueInput`; slide-over `ItemEditorPanel` (create/edit items).
7. Drag/resize on `ItemBar`; lane management; `FieldManager`.
8. Table view (sortable, custom columns) + filtering.
9. Sharing (share token, public `share/$token` route, read-only view).
10. Import/Export JSON.
11. Visual polish (theme tokens, light/dark), real-time verification.

---

## 10. Open items / assumptions

- Share links are **fully public** (anyone with the link, no sign-in required). If viewer sign-in
  is later desired, it slots into the same token path.
- `colorByFieldKey` defaults to the seeded `status` field; configurable per roadmap.
- Roadmap timeframe window is owner-set at creation and editable; items outside the window are
  clamped visually (still listed in the table).

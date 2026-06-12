# Seed demo data — multiple roadmaps + diagrams

**Date:** 2026-06-12
**Status:** Design approved

## Goal

Extend the dev/preview seed so the demo account is populated with **multiple, distinct
roadmaps** and a set of **sample diagrams**, all keyed to the same `DEMO_USER_ID`. The
seed must be **idempotent** (safe to re-run locally and in CI) and structured so adding a
future seedable object type is a one-file change.

Today `convex/seed.ts` inserts a single roadmap and nothing for diagrams. Running it twice
duplicates everything.

## Non-goals

- No schema changes, no UI changes, no auth changes (the seed stays a manual,
  non-auth-gated mutation invoked via `npx convex run seed:seedDemo`).
- No seeding of version history (`roadmapVersions` / `diagramVersions`) — those are created
  lazily by the app.
- No generic cross-type materialization helper — roadmaps and diagrams have genuinely
  different shapes (see Design rationale).

## Design rationale: what is and isn't reusable

The two object types are **not symmetric**, so we reuse deliberately rather than uniformly:

- **Materialization** — a roadmap is a parent row + four child tables (`fields`, `lanes`,
  `items`, `milestones`) requiring lane-index resolution. `applySnapshot` in
  `convex/lib/snapshot.ts` already does exactly this (it backs version-restore and JSON
  import) and is reused as-is. A diagram is a single flat row, so its "materialization" is
  one `ctx.db.insert` — extracting a shared helper there would be indirection with nothing
  behind it.
- **Wipe-then-seed lifecycle** — this *is* uniform across types and is the seam that makes
  adding a future object type cheap. It is abstracted behind a small `Seeder` interface and
  a registry.

## Architecture

```
convex/seed.ts                  # seedDemo mutation: wipe all seeders, then seed all seeders
convex/lib/seed/types.ts        # Seeder interface
convex/lib/seed/index.ts        # SEEDERS registry array
convex/lib/seed/roadmaps.ts     # DEMO_ROADMAPS data + roadmapSeeder (wipe + seed)
convex/lib/seed/diagrams.ts     # DEMO_DIAGRAMS data + diagramSeeder (wipe + seed)
```

### `Seeder` interface (`convex/lib/seed/types.ts`)

```ts
import type { MutationCtx } from "../../_generated/server";

export interface Seeder {
	/** Stable key used in the returned counts map. */
	name: string;
	/** Delete every row this seeder owns for the given user (rows + children + versions). */
	wipe(ctx: MutationCtx, userId: string): Promise<void>;
	/** Insert this seeder's demo content; returns the number of top-level rows created. */
	seed(ctx: MutationCtx, userId: string): Promise<number>;
}
```

Each seeder module owns its own data, knows its own child tables/indexes, and reports how
many top-level rows it created.

### Registry (`convex/lib/seed/index.ts`)

```ts
import { roadmapSeeder } from "./roadmaps";
import { diagramSeeder } from "./diagrams";
import type { Seeder } from "./types";

export const SEEDERS: Seeder[] = [roadmapSeeder, diagramSeeder];
```

Adding a future object type = write `convex/lib/seed/<thing>.ts` implementing `Seeder` and
append it here. `seed.ts` does not change.

### Orchestrator (`convex/seed.ts`)

```ts
const DEMO_USER_ID = "user_2tTlbmSTh4kbXmg9v6EN7YW3B4d";

export const seedDemo = mutation({
	args: { userId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const userId = args.userId ?? DEMO_USER_ID;
		// Wipe everything first, then seed everything — keeps cross-type references clean
		// if any are ever introduced.
		for (const s of SEEDERS) await s.wipe(ctx, userId);
		const counts: Record<string, number> = {};
		for (const s of SEEDERS) counts[s.name] = await s.seed(ctx, userId);
		return counts; // e.g. { roadmaps: 4, diagrams: 7 }
	},
});
```

`DEMO_USER_ID` and the `d(month, day)` UTC date helper move to wherever they are used
(`DEMO_USER_ID` stays in `seed.ts`; date helpers live alongside the data in the seeder
modules).

## Roadmap seeder

`DEMO_ROADMAPS` is an array of specs, each:

```ts
{
	description?: string;
	visibility: "private" | "link";
	shareToken?: string;        // set when visibility === "link"
	archived: boolean;
	snapshot: RoadmapSnapshot;  // Infer<typeof roadmapSnapshotValidator> — see convex/lib/snapshot.ts
}
```

`seed()`: for each spec, `ctx.db.insert("roadmaps", { userId, name: snapshot.name,
startDate, endDate, defaultZoom, colorByFieldKey, barColorMode, description, visibility,
shareToken, archived })`, then `applySnapshot(ctx, id, userId, snapshot)` to populate
children. Returns the spec count.

`wipe()`: query `roadmaps.by_user` for `userId`; for each, delete its `fields`, `lanes`,
`items`, `milestones` (each `.by_roadmap`), its `roadmapVersions` (`.by_roadmap`), then the
roadmap row.

`shareToken` values are **hard-coded** into the data as fixed hex strings (e.g. a
32-char `crypto.randomUUID().replace(/-/g, "")` value generated once at authoring time), so
a bookmarked demo share link keeps working across re-seeds. Same approach for the shared
diagram's token.

### Seeded roadmaps (4)

| Roadmap | Fields (types exercised) | Lanes | Notable edge cases |
|---|---|---|---|
| **Product Roadmap 2026** | `status`*(select), `team`(select), `effort`(number) | Now / Next / Later | `visibility:"link"` + shareToken; `colorByFieldKey:"status"`, `barColorMode:"left"`; some items omit `effort` and `description` |
| **Marketing & GTM 2026** | `priority`(select), `channel`(**multiselect**), `owner`(**text**), `budget`(number) | Campaigns / Content / Events | `colorByFieldKey:"priority"`, `barColorMode:"fill"`; one item with empty multiselect `[]` and blank `owner` text |
| **Platform & Infra 2026** | `status`*(select), `severity`(select), `targetDate`(**date**) | Reliability / Security / Cost | `defaultZoom:"quarter"`; a number `0` and a `null` select value; **no milestones** (empty array) |
| **Personal OKRs 2025** | `status`* only | single default lane | `archived:true`; minimal items; **single-lane**; exercises archived-filter in the list view |

`*` = system status field (`isSystem: true`, key from `STATUS_FIELD_KEY`, options from
`DEFAULT_STATUS_OPTIONS` in `convex/lib/defaults.ts`).

Across the four roadmaps, the seed exercises: **all five field types**
(text/number/date/select/multiselect), **empty optional values**, **null/zero values**,
**archived**, **shared (link)**, **single-lane**, **no-milestones**, and both
`barColorMode` values.

## Diagram seeder

`DEMO_DIAGRAMS` is an array of specs, each:

```ts
{
	title: string;
	type: "mermaid" | "plantuml";
	source: string;
	visibility: "private" | "link";
	shareToken?: string;
	archived: boolean;
}
```

`seed()`: `ctx.db.insert("diagrams", { userId, ...spec, source: spec.source })` per spec;
returns the count. `wipe()`: query `diagrams.by_user`; delete each diagram's
`diagramVersions` (`.by_diagram`) then the diagram row.

### Seeded diagrams (7)

| Title | Type | Notable |
|---|---|---|
| Product architecture overview | mermaid (flowchart) | `visibility:"link"` + shareToken |
| Auth & onboarding flow | mermaid (sequence) | echoes a Product roadmap item |
| Data model | mermaid (ER) | |
| Release timeline | mermaid (gantt) | |
| Domain model | plantuml (class) | |
| Realtime collaboration sync | plantuml (sequence) | echoes a Product roadmap item |
| Untitled diagram | mermaid | **empty draft** (`source:""`) + **archived** |

Titles intentionally echo roadmap item names so the demo account feels coherent. Diagram
`source` strings must be valid for their renderer.

## Testing

New `convex/seed.test.ts` (convex-test, `import.meta.glob("./**/*.ts")` per the project
convention):

1. **Counts** — run `seedDemo({})` once; assert the returned counts and the row counts in
   `roadmaps` / `diagrams` for `DEMO_USER_ID` match the spec arrays' lengths.
2. **Children + values round-trip** — assert a known roadmap's `items.values` contains the
   expected custom-field values (including an empty multiselect / null case).
3. **Idempotent re-run** — run `seedDemo({})` **twice**; assert total row counts are
   unchanged (the wipe removed the first run's data).

Plus the standard gates: `npm run check`, `npx tsc --noEmit`, `npx convex dev --once`
(deploy typecheck + regenerate `_generated`), `npm run test`.

## Impact on existing callers

- `package.json` `"seed": "npx convex run seed:seedDemo"` — unchanged (same entrypoint).
- `.github/workflows/preview.yml` `--preview-run seed:seedDemo` — unchanged; now produces a
  richer fresh-backend demo.

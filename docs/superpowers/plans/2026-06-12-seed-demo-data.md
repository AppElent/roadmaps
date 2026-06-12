# Seed Demo Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-roadmap dev/preview seed with an idempotent seeder that populates the demo account with 4 distinct roadmaps and 7 sample diagrams, all keyed to `DEMO_USER_ID`.

**Architecture:** A small `Seeder` interface (`{ name, wipe, seed }`) with one module per object type, collected in a `SEEDERS` registry. `convex/seed.ts#seedDemo` wipes every seeder then seeds every seeder. Roadmaps reuse the existing `applySnapshot` helper (parent row + 4 child tables, lane-by-index); diagrams are flat single-row inserts. Re-running wipes the demo user's prior data first, so it is safe to run repeatedly.

**Tech Stack:** Convex (TypeScript serverless mutations), `convex-test` + Vitest, Biome (tabs, double quotes).

---

## File structure

| File | Responsibility |
|---|---|
| `convex/lib/seed/types.ts` (new) | `Seeder` interface |
| `convex/lib/seed/diagrams.ts` (new) | `DiagramSeed` type, `DEMO_DIAGRAMS` data, `diagramSeeder` |
| `convex/lib/seed/roadmaps.ts` (new) | `RoadmapSeed` type, `DEMO_ROADMAPS` data, `roadmapSeeder` |
| `convex/lib/seed/index.ts` (new) | `SEEDERS` registry array |
| `convex/seed.ts` (rewrite) | `seedDemo` mutation: wipe-all then seed-all, returns counts |
| `convex/seed.test.ts` (new) | counts, values round-trip, idempotent re-run |

Reused unchanged: `applySnapshot` and `RoadmapSnapshot` from `convex/lib/snapshot.ts`; `STATUS_FIELD_KEY` and `DEFAULT_STATUS_OPTIONS` from `convex/lib/defaults.ts`.

---

## Task 1: Write the failing seed test

**Files:**
- Create: `convex/seed.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const USER = "user_seed_test";

test("seedDemo inserts the expected roadmaps and diagrams", async () => {
	const t = convexTest(schema, modules);
	const counts = await t.mutation(api.seed.seedDemo, { userId: USER });
	expect(counts).toEqual({ roadmaps: 4, diagrams: 7 });

	const { roadmaps, diagrams } = await t.run(async (ctx) => {
		const roadmaps = await ctx.db
			.query("roadmaps")
			.withIndex("by_user", (q) => q.eq("userId", USER))
			.collect();
		const diagrams = await ctx.db
			.query("diagrams")
			.withIndex("by_user", (q) => q.eq("userId", USER))
			.collect();
		return { roadmaps, diagrams };
	});
	expect(roadmaps).toHaveLength(4);
	expect(diagrams).toHaveLength(7);
});

test("seeded items carry their custom field values", async () => {
	const t = convexTest(schema, modules);
	await t.mutation(api.seed.seedDemo, { userId: USER });

	const items = await t.run(async (ctx) => {
		const all = await ctx.db
			.query("roadmaps")
			.withIndex("by_user", (q) => q.eq("userId", USER))
			.collect();
		const marketing = all.find((r) => r.name === "Marketing & GTM 2026");
		if (!marketing) throw new Error("Marketing roadmap not seeded");
		return await ctx.db
			.query("items")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", marketing._id))
			.collect();
	});

	// Edge case: at least one item has an empty multiselect channel value.
	expect(
		items.some(
			(it) => Array.isArray(it.values.channel) && it.values.channel.length === 0,
		),
	).toBe(true);
	// Edge case: at least one item has a budget of 0.
	expect(items.some((it) => it.values.budget === 0)).toBe(true);
});

test("seedDemo is idempotent across re-runs", async () => {
	const t = convexTest(schema, modules);
	await t.mutation(api.seed.seedDemo, { userId: USER });
	await t.mutation(api.seed.seedDemo, { userId: USER });

	const counts = await t.run(async (ctx) => ({
		roadmaps: (await ctx.db.query("roadmaps").collect()).length,
		diagrams: (await ctx.db.query("diagrams").collect()).length,
		items: (await ctx.db.query("items").collect()).length,
		lanes: (await ctx.db.query("lanes").collect()).length,
		fields: (await ctx.db.query("fields").collect()).length,
	}));

	// Two runs must equal one run — the wipe removed the first run's rows.
	expect(counts.roadmaps).toBe(4);
	expect(counts.diagrams).toBe(7);
	expect(counts.items).toBeGreaterThan(0);
	expect(counts.lanes).toBeGreaterThan(0);
	expect(counts.fields).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run convex/seed.test.ts`
Expected: FAIL — current `seedDemo` returns a roadmap id (a string), so `expect(counts).toEqual({ roadmaps: 4, diagrams: 7 })` fails (and `api.seed.seedDemo` still has the old signature).

- [ ] **Step 3: Commit**

```bash
git add convex/seed.test.ts
git commit -m "test(seed): failing tests for multi-roadmap + diagram seed"
```

---

## Task 2: Seeder interface

**Files:**
- Create: `convex/lib/seed/types.ts`

- [ ] **Step 1: Write the interface**

```ts
import type { MutationCtx } from "../../_generated/server";

/**
 * One seedable object type. Each module owns its demo data, knows its own child
 * tables/indexes, and reports how many top-level rows it created.
 */
export interface Seeder {
	/** Stable key used in the seedDemo counts map. */
	name: string;
	/** Delete every row this seeder owns for the user (rows + children + versions). */
	wipe(ctx: MutationCtx, userId: string): Promise<void>;
	/** Insert this seeder's demo content; returns the number of top-level rows. */
	seed(ctx: MutationCtx, userId: string): Promise<number>;
}
```

- [ ] **Step 2: Format check**

Run: `npx biome check convex/lib/seed/types.ts`
Expected: PASS (no diagnostics).

- [ ] **Step 3: Commit**

```bash
git add convex/lib/seed/types.ts
git commit -m "feat(seed): add Seeder interface"
```

---

## Task 3: Diagram seeder

**Files:**
- Create: `convex/lib/seed/diagrams.ts`

- [ ] **Step 1: Write the diagram seeder + data**

```ts
import type { Seeder } from "./types";

export interface DiagramSeed {
	title: string;
	type: "mermaid" | "plantuml";
	source: string;
	visibility: "private" | "link";
	shareToken?: string;
	archived: boolean;
}

const FLOWCHART = `flowchart TD
  U[User] --> W[Cloudflare Worker]
  W --> Clerk[Clerk Auth]
  W --> C[Convex]
  C --> DB[(Database)]`;

const SEQUENCE_AUTH = `sequenceDiagram
  participant U as User
  participant A as App
  participant C as Clerk
  U->>A: Sign up
  A->>C: Create session
  C-->>A: JWT
  A-->>U: Onboarding`;

const ER = `erDiagram
  ROADMAPS ||--o{ FIELDS : defines
  ROADMAPS ||--o{ LANES : has
  LANES ||--o{ ITEMS : contains
  ROADMAPS ||--o{ MILESTONES : marks`;

const GANTT = `gantt
  title Release Timeline
  dateFormat YYYY-MM-DD
  section Product
  Design system refresh :2026-01-06, 52d
  Realtime collaboration :2026-03-09, 67d
  section GTM
  Pricing & billing :2026-05-04, 60d`;

const PUML_CLASS = `@startuml
class Roadmap {
  +name: string
  +startDate: number
}
class Lane
class Item
Roadmap "1" o-- "many" Lane
Lane "1" o-- "many" Item
@enduml`;

const PUML_SEQUENCE = `@startuml
actor User
User -> App : edit item
App -> Convex : items.update
Convex --> App : real-time snapshot
App --> User : live update
@enduml`;

export const DEMO_DIAGRAMS: DiagramSeed[] = [
	{
		title: "Product architecture overview",
		type: "mermaid",
		source: FLOWCHART,
		visibility: "link",
		shareToken: "d1a9f0c2b3e44d5e6f7a8b9c0d1e2f30",
		archived: false,
	},
	{
		title: "Auth & onboarding flow",
		type: "mermaid",
		source: SEQUENCE_AUTH,
		visibility: "private",
		archived: false,
	},
	{
		title: "Data model",
		type: "mermaid",
		source: ER,
		visibility: "private",
		archived: false,
	},
	{
		title: "Release timeline",
		type: "mermaid",
		source: GANTT,
		visibility: "private",
		archived: false,
	},
	{
		title: "Domain model",
		type: "plantuml",
		source: PUML_CLASS,
		visibility: "private",
		archived: false,
	},
	{
		title: "Realtime collaboration sync",
		type: "plantuml",
		source: PUML_SEQUENCE,
		visibility: "private",
		archived: false,
	},
	{
		// Edge cases: empty draft source + archived.
		title: "Untitled diagram",
		type: "mermaid",
		source: "",
		visibility: "private",
		archived: true,
	},
];

export const diagramSeeder: Seeder = {
	name: "diagrams",
	async wipe(ctx, userId) {
		const diagrams = await ctx.db
			.query("diagrams")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		for (const diagram of diagrams) {
			const versions = await ctx.db
				.query("diagramVersions")
				.withIndex("by_diagram", (q) => q.eq("diagramId", diagram._id))
				.collect();
			for (const version of versions) {
				await ctx.db.delete(version._id);
			}
			await ctx.db.delete(diagram._id);
		}
	},
	async seed(ctx, userId) {
		for (const spec of DEMO_DIAGRAMS) {
			await ctx.db.insert("diagrams", { userId, ...spec });
		}
		return DEMO_DIAGRAMS.length;
	},
};
```

- [ ] **Step 2: Format check**

Run: `npx biome check convex/lib/seed/diagrams.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/lib/seed/diagrams.ts
git commit -m "feat(seed): add diagram seeder with sample mermaid + plantuml"
```

---

## Task 4: Roadmap seeder

**Files:**
- Create: `convex/lib/seed/roadmaps.ts`

- [ ] **Step 1: Write the roadmap seeder + data**

This is the largest file. The four roadmap snapshots deliberately exercise all five field types, empty optional values, a `null` select value, a `0` number, an archived roadmap, a shared (link) roadmap, a single-lane roadmap, and an empty-milestones roadmap.

```ts
import type { Infer } from "convex/values";
import { DEFAULT_STATUS_OPTIONS, STATUS_FIELD_KEY } from "../defaults";
import { applySnapshot, type RoadmapSnapshot } from "../snapshot";
import type { fieldOptionValidator } from "../../schema";
import type { Seeder } from "./types";

type FieldOption = Infer<typeof fieldOptionValidator>;

export interface RoadmapSeed {
	description?: string;
	visibility: "private" | "link";
	shareToken?: string;
	archived: boolean;
	snapshot: RoadmapSnapshot;
}

/** Epoch ms for a UTC calendar date. */
const d = (year: number, month: number, day: number): number =>
	Date.UTC(year, month - 1, day);

const TEAM_OPTIONS: FieldOption[] = [
	{ id: "design", label: "Design", color: "#c7a3e0" },
	{ id: "eng", label: "Engineering", color: "#9bc2e0" },
	{ id: "gtm", label: "Go-to-market", color: "#e0c79b" },
];

const PRIORITY_OPTIONS: FieldOption[] = [
	{ id: "low", label: "Low", color: "#9bc2e0" },
	{ id: "med", label: "Medium", color: "#e0c79b" },
	{ id: "high", label: "High", color: "#e09b9b" },
];

const CHANNEL_OPTIONS: FieldOption[] = [
	{ id: "email", label: "Email", color: "#9bc2e0" },
	{ id: "social", label: "Social", color: "#c7a3e0" },
	{ id: "seo", label: "SEO", color: "#9bd5a8" },
	{ id: "events", label: "Events", color: "#e0c79b" },
	{ id: "paid", label: "Paid", color: "#e09b9b" },
];

const SEVERITY_OPTIONS: FieldOption[] = [
	{ id: "low", label: "Low", color: "#9bd5a8" },
	{ id: "med", label: "Medium", color: "#e0c79b" },
	{ id: "high", label: "High", color: "#e09b9b" },
	{ id: "critical", label: "Critical", color: "#d46a6a" },
];

const statusField = {
	key: STATUS_FIELD_KEY,
	label: "Status",
	type: "select" as const,
	options: DEFAULT_STATUS_OPTIONS,
	order: 0,
	showInTable: true,
	isSystem: true,
};

const product: RoadmapSnapshot = {
	name: "Product Roadmap 2026",
	startDate: d(2026, 1, 1),
	endDate: d(2026, 12, 31),
	defaultZoom: "month",
	colorByFieldKey: STATUS_FIELD_KEY,
	barColorMode: "left",
	fields: [
		statusField,
		{ key: "team", label: "Team", type: "select", options: TEAM_OPTIONS, order: 1, showInTable: true },
		{ key: "effort", label: "Effort (pts)", type: "number", order: 2, showInTable: true },
	],
	lanes: [
		{ name: "Now", order: 0, isDefault: true },
		{ name: "Next", order: 1 },
		{ name: "Later", order: 2 },
	],
	items: [
		{ title: "Design system refresh", laneIndex: 0, startDate: d(2026, 1, 6), endDate: d(2026, 2, 27), description: "Token overhaul and component audit.", values: { status: "done", team: "design", effort: 8 }, order: 0 },
		{ title: "Auth & onboarding revamp", laneIndex: 0, startDate: d(2026, 2, 2), endDate: d(2026, 3, 20), values: { status: "in_progress", team: "eng", effort: 13 }, order: 1 },
		{ title: "Realtime collaboration", laneIndex: 0, startDate: d(2026, 3, 9), endDate: d(2026, 5, 15), description: "Multi-cursor editing on shared roadmaps.", values: { status: "in_progress", team: "eng", effort: 21 }, order: 2 },
		{ title: "Public share links", laneIndex: 1, startDate: d(2026, 4, 1), endDate: d(2026, 5, 8), values: { status: "planned", team: "eng", effort: 5 }, order: 0 },
		{ title: "Pricing & billing", laneIndex: 1, startDate: d(2026, 5, 4), endDate: d(2026, 7, 3), description: "Seat-based plans and self-serve upgrade.", values: { status: "planned", team: "gtm", effort: 13 }, order: 1 },
		// Edge case: optional number field (effort) omitted, no description.
		{ title: "Mobile responsive timeline", laneIndex: 1, startDate: d(2026, 6, 15), endDate: d(2026, 8, 14), values: { status: "blocked", team: "design" }, order: 2 },
		{ title: "Analytics dashboard", laneIndex: 2, startDate: d(2026, 8, 3), endDate: d(2026, 9, 25), values: { status: "planned", team: "eng", effort: 13 }, order: 0 },
		// Edge case: optional number field (effort) omitted, but has a description.
		{ title: "Template marketplace", laneIndex: 2, startDate: d(2026, 9, 14), endDate: d(2026, 11, 6), description: "Community-shared roadmap templates.", values: { status: "planned", team: "gtm" }, order: 1 },
		{ title: "AI roadmap assistant", laneIndex: 2, startDate: d(2026, 10, 19), endDate: d(2026, 12, 18), values: { status: "planned", team: "eng", effort: 21 }, order: 2 },
	],
	milestones: [
		{ name: "Q2 Launch", date: d(2026, 6, 30), color: "#9bd5a8" },
		{ name: "GA", date: d(2026, 11, 15), color: "#e0c79b" },
	],
};

const marketing: RoadmapSnapshot = {
	name: "Marketing & GTM 2026",
	startDate: d(2026, 1, 1),
	endDate: d(2026, 12, 31),
	defaultZoom: "month",
	colorByFieldKey: "priority",
	barColorMode: "fill",
	fields: [
		{ key: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS, order: 0, showInTable: true },
		{ key: "channel", label: "Channels", type: "multiselect", options: CHANNEL_OPTIONS, order: 1, showInTable: true },
		{ key: "owner", label: "Owner", type: "text", order: 2, showInTable: true },
		{ key: "budget", label: "Budget ($)", type: "number", order: 3, showInTable: true },
	],
	lanes: [
		{ name: "Campaigns", order: 0, isDefault: true },
		{ name: "Content", order: 1 },
		{ name: "Events", order: 2 },
	],
	items: [
		{ title: "Spring brand campaign", laneIndex: 0, startDate: d(2026, 2, 1), endDate: d(2026, 4, 15), description: "Cross-channel brand push.", values: { priority: "high", channel: ["email", "social", "paid"], owner: "Dana", budget: 25000 }, order: 0 },
		{ title: "Lifecycle email revamp", laneIndex: 0, startDate: d(2026, 3, 1), endDate: d(2026, 5, 1), values: { priority: "med", channel: ["email"], owner: "Priya", budget: 8000 }, order: 1 },
		// Edge cases: blank text (owner) + number 0 (budget).
		{ title: "SEO content refresh", laneIndex: 1, startDate: d(2026, 1, 15), endDate: d(2026, 6, 30), values: { priority: "med", channel: ["seo"], owner: "", budget: 0 }, order: 0 },
		// Edge case: empty multiselect (channel).
		{ title: "Customer story series", laneIndex: 1, startDate: d(2026, 4, 1), endDate: d(2026, 9, 30), values: { priority: "low", channel: [], owner: "Lee", budget: 5000 }, order: 1 },
		{ title: "User conference 2026", laneIndex: 2, startDate: d(2026, 8, 1), endDate: d(2026, 9, 18), description: "Annual flagship event.", values: { priority: "high", channel: ["events", "social"], owner: "Sam", budget: 60000 }, order: 0 },
		{ title: "Webinar series", laneIndex: 2, startDate: d(2026, 5, 1), endDate: d(2026, 11, 30), values: { priority: "med", channel: ["events", "email"], owner: "Sam", budget: 12000 }, order: 1 },
	],
	milestones: [{ name: "Conference", date: d(2026, 9, 15), color: "#c7a3e0" }],
};

const infra: RoadmapSnapshot = {
	name: "Platform & Infra 2026",
	startDate: d(2026, 1, 1),
	endDate: d(2026, 12, 31),
	defaultZoom: "quarter",
	colorByFieldKey: STATUS_FIELD_KEY,
	fields: [
		statusField,
		{ key: "severity", label: "Severity", type: "select", options: SEVERITY_OPTIONS, order: 1, showInTable: true },
		{ key: "targetDate", label: "Target date", type: "date", order: 2, showInTable: true },
	],
	lanes: [
		{ name: "Reliability", order: 0, isDefault: true },
		{ name: "Security", order: 1 },
		{ name: "Cost", order: 2 },
	],
	items: [
		{ title: "Multi-region failover", laneIndex: 0, startDate: d(2026, 1, 6), endDate: d(2026, 6, 30), description: "Active-active across two regions.", values: { status: "in_progress", severity: "critical", targetDate: d(2026, 6, 30) }, order: 0 },
		{ title: "Observability revamp", laneIndex: 0, startDate: d(2026, 4, 1), endDate: d(2026, 9, 1), values: { status: "planned", severity: "high", targetDate: d(2026, 9, 1) }, order: 1 },
		// Edge case: empty date value (null).
		{ title: "Zero-downtime deploys", laneIndex: 0, startDate: d(2026, 7, 1), endDate: d(2026, 10, 15), values: { status: "planned", severity: "med", targetDate: null }, order: 2 },
		{ title: "Secrets rotation", laneIndex: 1, startDate: d(2026, 2, 1), endDate: d(2026, 5, 15), values: { status: "planned", severity: "high", targetDate: d(2026, 5, 15) }, order: 0 },
		{ title: "Pen-test remediation", laneIndex: 1, startDate: d(2026, 1, 20), endDate: d(2026, 4, 1), description: "Fix findings from Q4 audit.", values: { status: "blocked", severity: "critical", targetDate: d(2026, 4, 1) }, order: 1 },
		// Edge case: null select value (severity).
		{ title: "Compute cost audit", laneIndex: 2, startDate: d(2026, 5, 1), endDate: d(2026, 8, 1), values: { status: "planned", severity: null, targetDate: d(2026, 8, 1) }, order: 0 },
	],
	// Edge case: no milestones.
	milestones: [],
};

const okrs: RoadmapSnapshot = {
	name: "Personal OKRs 2025",
	startDate: d(2025, 1, 1),
	endDate: d(2025, 12, 31),
	defaultZoom: "month",
	colorByFieldKey: STATUS_FIELD_KEY,
	fields: [statusField],
	// Edge case: single default lane only.
	lanes: [{ name: "Goals", order: 0, isDefault: true }],
	items: [
		{ title: "Run a half marathon", laneIndex: 0, startDate: d(2025, 1, 1), endDate: d(2025, 4, 30), description: "Sub-2:00 target.", values: { status: "done" }, order: 0 },
		{ title: "Read 20 books", laneIndex: 0, startDate: d(2025, 1, 1), endDate: d(2025, 12, 31), values: { status: "in_progress" }, order: 1 },
		{ title: "Learn Spanish", laneIndex: 0, startDate: d(2025, 3, 1), endDate: d(2025, 12, 31), values: { status: "planned" }, order: 2 },
	],
	milestones: [],
};

export const DEMO_ROADMAPS: RoadmapSeed[] = [
	{
		description: "Demo roadmap seeded for local development.",
		visibility: "link",
		shareToken: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
		archived: false,
		snapshot: product,
	},
	{
		description: "Cross-channel marketing and go-to-market plan.",
		visibility: "private",
		archived: false,
		snapshot: marketing,
	},
	{
		description: "Reliability, security and cost initiatives.",
		visibility: "private",
		archived: false,
		snapshot: infra,
	},
	{
		description: "Archived personal goals from last year.",
		visibility: "private",
		archived: true,
		snapshot: okrs,
	},
];

export const roadmapSeeder: Seeder = {
	name: "roadmaps",
	async wipe(ctx, userId) {
		const roadmaps = await ctx.db
			.query("roadmaps")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		for (const roadmap of roadmaps) {
			const fields = await ctx.db
				.query("fields")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of fields) await ctx.db.delete(row._id);

			const lanes = await ctx.db
				.query("lanes")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of lanes) await ctx.db.delete(row._id);

			const items = await ctx.db
				.query("items")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of items) await ctx.db.delete(row._id);

			const milestones = await ctx.db
				.query("milestones")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of milestones) await ctx.db.delete(row._id);

			const versions = await ctx.db
				.query("roadmapVersions")
				.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
				.collect();
			for (const row of versions) await ctx.db.delete(row._id);

			await ctx.db.delete(roadmap._id);
		}
	},
	async seed(ctx, userId) {
		for (const spec of DEMO_ROADMAPS) {
			const { snapshot } = spec;
			const roadmapId = await ctx.db.insert("roadmaps", {
				userId,
				name: snapshot.name,
				description: spec.description,
				startDate: snapshot.startDate,
				endDate: snapshot.endDate,
				defaultZoom: snapshot.defaultZoom,
				colorByFieldKey: snapshot.colorByFieldKey,
				barColorMode: snapshot.barColorMode,
				visibility: spec.visibility,
				shareToken: spec.shareToken,
				archived: spec.archived,
			});
			await applySnapshot(ctx, roadmapId, userId, snapshot);
		}
		return DEMO_ROADMAPS.length;
	},
};
```

- [ ] **Step 2: Format check**

Run: `npx biome check convex/lib/seed/roadmaps.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/lib/seed/roadmaps.ts
git commit -m "feat(seed): add roadmap seeder with 4 demo roadmaps"
```

---

## Task 5: Registry + rewrite the mutation (turns the tests green)

**Files:**
- Create: `convex/lib/seed/index.ts`
- Modify: `convex/seed.ts` (full rewrite)

- [ ] **Step 1: Write the registry**

`convex/lib/seed/index.ts`:

```ts
import { diagramSeeder } from "./diagrams";
import { roadmapSeeder } from "./roadmaps";
import type { Seeder } from "./types";

/** All seedable object types. Add a new module here to extend the demo seed. */
export const SEEDERS: Seeder[] = [roadmapSeeder, diagramSeeder];
```

- [ ] **Step 2: Rewrite the mutation**

Replace the entire contents of `convex/seed.ts` with:

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { SEEDERS } from "./lib/seed";

/**
 * Dev-only seed. Wipes the demo account's data, then re-populates it with multiple
 * roadmaps and sample diagrams. Idempotent — safe to re-run locally and in CI.
 * NOT auth-gated — invoke manually:
 *   npx convex run seed:seedDemo '{}'
 * Pass {"userId":"..."} to target a different account.
 */
const DEMO_USER_ID = "user_2tTlbmSTh4kbXmg9v6EN7YW3B4d";

export const seedDemo = mutation({
	args: { userId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const userId = args.userId ?? DEMO_USER_ID;
		// Wipe everything first, then seed everything — keeps cross-type references
		// clean if any are ever introduced.
		for (const seeder of SEEDERS) {
			await seeder.wipe(ctx, userId);
		}
		const counts: Record<string, number> = {};
		for (const seeder of SEEDERS) {
			counts[seeder.name] = await seeder.seed(ctx, userId);
		}
		return counts;
	},
});
```

- [ ] **Step 3: Run the seed tests to verify they pass**

Run: `npx vitest run convex/seed.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 4: Commit**

```bash
git add convex/lib/seed/index.ts convex/seed.ts
git commit -m "feat(seed): wire seeder registry into seedDemo mutation"
```

---

## Task 6: Full verification gates

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: PASS (all suites, including `convex/seed.test.ts`, `convex/diagrams.test.ts`, `convex/roadmapVersions.test.ts`).

- [ ] **Step 2: Lint + format**

Run: `npm run check`
Expected: PASS. If it reports fixable issues, run `npx biome check --write convex/` then re-run.

- [ ] **Step 3: Deploy typecheck + regenerate `_generated`**

Run: `npx convex dev --once`
Expected: Succeeds; `convex/seed.ts`, `convex/lib/seed/*` typecheck against the schema; `convex/_generated` reflects the unchanged `api.seed.seedDemo` signature.

- [ ] **Step 4: Root typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 5: Manual smoke (optional, requires a running backend)**

With `npx convex dev` running in another terminal:
Run: `npm run seed`
Expected: prints a counts object `{ roadmaps: 4, diagrams: 7 }`. Running it a second time prints the same — no duplicates.

- [ ] **Step 6: Commit any regenerated files**

```bash
git add -A
git commit -m "chore(seed): regenerate convex types after seed changes" || echo "nothing to commit"
```

---

## Self-review notes

- **Spec coverage:** seeder-registry (Task 2/5) ✓; `applySnapshot` reuse for roadmaps (Task 4) ✓; flat diagram inserts (Task 3) ✓; 4 roadmaps with the documented field/edge matrix (Task 4) ✓; 7 diagrams both renderers + empty draft + archived (Task 3) ✓; idempotent wipe-then-seed (Task 5) ✓; hard-coded share tokens (Task 3 & 4) ✓; counts-return + values round-trip + re-run tests (Task 1) ✓; entrypoint/CI unchanged (Task 5 keeps `seed:seedDemo`) ✓.
- **Edge-case matrix realized in data:** all five field types (text=owner, number=effort/budget, date=targetDate, select=status/team/priority/severity, multiselect=channel); empty optional (effort omitted); empty multiselect (`channel: []`); blank text (`owner: ""`); zero number (`budget: 0`); null select (`severity: null`); null date (`targetDate: null`); archived roadmap (okrs) + archived diagram (Untitled); shared link (product + Product architecture diagram); single lane (okrs); no milestones (infra, okrs).
- **Type consistency:** `Seeder.name`/`wipe`/`seed` used identically in both seeder modules and `seed.ts`; `RoadmapSnapshot`/`applySnapshot` imported from `../snapshot`; `STATUS_FIELD_KEY`/`DEFAULT_STATUS_OPTIONS` from `../defaults`; counts keys (`"roadmaps"`,`"diagrams"`) match the seeders' `name` values and the test's `toEqual({ roadmaps: 4, diagrams: 7 })`.

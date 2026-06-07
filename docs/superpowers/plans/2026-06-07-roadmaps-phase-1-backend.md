# Roadmaps Phase 1 — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the full data model and all authed Convex queries/mutations, with `convex-test` coverage of auth, ownership, seeding, and lane-delete behavior.

**Architecture:** One file per domain (`roadmaps`, `fields`, `lanes`, `items`, `milestones`). Every function calls `requireUser`; every write re-verifies roadmap ownership via `requireRoadmapOwner`. Custom-field values are stored as an embedded `values` record (Approach A). A single `getBundle` query returns roadmap + fields + lanes + items + milestones for the editor's real-time subscription.

**Tech Stack:** Convex (`convex/server`, `convex/values`), `convex-test`, Vitest.

**Depends on:** Phase 0 (auth wiring, `requireUser`, Vitest config).

---

## File structure for this phase

- Modify: `convex/schema.ts` — all five tables + shared validators
- Modify: `convex/lib/auth.ts` — add `requireRoadmapOwner`
- Create: `convex/lib/defaults.ts` — seeded default status options + ids
- Create: `convex/roadmaps.ts` — `list`, `get`, `getBundle`, `create`, `update`, `archive`, `duplicate`, `enableShare`, `disableShare`
- Create: `convex/fields.ts` — `create`, `update`, `reorder`, `remove`
- Create: `convex/lanes.ts` — `create`, `update`, `reorder`, `remove`
- Create: `convex/items.ts` — `create`, `update`, `remove`
- Create: `convex/milestones.ts` — `create`, `update`, `remove`
- Create: `convex/roadmaps.test.ts`, `convex/lanes.test.ts`, `convex/items.test.ts` — `convex-test` coverage

---

### Task 1: Install convex-test and define the schema

**Files:**
- Modify: `package.json` (devDependency)
- Modify: `convex/schema.ts`

- [ ] **Step 1: Install `convex-test`**

Run: `npm install -D convex-test`
Expected: `convex-test` appears under `devDependencies`.

- [ ] **Step 2: Write the schema**

Replace `convex/schema.ts` entirely. The exported validators are reused by function `args`.

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const zoomValidator = v.union(
	v.literal("week"),
	v.literal("month"),
	v.literal("quarter"),
	v.literal("half"),
);

export const fieldTypeValidator = v.union(
	v.literal("text"),
	v.literal("number"),
	v.literal("date"),
	v.literal("select"),
	v.literal("multiselect"),
);

export const fieldOptionValidator = v.object({
	id: v.string(),
	label: v.string(),
	color: v.string(),
});

export const fieldValueValidator = v.union(
	v.string(),
	v.number(),
	v.array(v.string()),
	v.null(),
);

export default defineSchema({
	roadmaps: defineTable({
		userId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		startDate: v.number(),
		endDate: v.number(),
		defaultZoom: zoomValidator,
		colorByFieldKey: v.optional(v.string()),
		visibility: v.union(v.literal("private"), v.literal("link")),
		shareToken: v.optional(v.string()),
		archived: v.boolean(),
	})
		.index("by_user", ["userId"])
		.index("by_user_archived", ["userId", "archived"])
		.index("by_shareToken", ["shareToken"]),

	fields: defineTable({
		roadmapId: v.id("roadmaps"),
		userId: v.string(),
		key: v.string(),
		label: v.string(),
		type: fieldTypeValidator,
		options: v.optional(v.array(fieldOptionValidator)),
		order: v.number(),
		showInTable: v.boolean(),
		isSystem: v.optional(v.boolean()),
	}).index("by_roadmap", ["roadmapId"]),

	lanes: defineTable({
		roadmapId: v.id("roadmaps"),
		userId: v.string(),
		name: v.string(),
		color: v.optional(v.string()),
		order: v.number(),
		isDefault: v.optional(v.boolean()),
	}).index("by_roadmap", ["roadmapId"]),

	items: defineTable({
		roadmapId: v.id("roadmaps"),
		laneId: v.id("lanes"),
		userId: v.string(),
		title: v.string(),
		startDate: v.number(),
		endDate: v.number(),
		description: v.optional(v.string()),
		values: v.record(v.string(), fieldValueValidator),
		order: v.number(),
	})
		.index("by_roadmap", ["roadmapId"])
		.index("by_roadmap_lane", ["roadmapId", "laneId"]),

	milestones: defineTable({
		roadmapId: v.id("roadmaps"),
		userId: v.string(),
		name: v.string(),
		date: v.number(),
		color: v.optional(v.string()),
	}).index("by_roadmap", ["roadmapId"]),
});
```

- [ ] **Step 3: Regenerate types**

Run: `npx convex dev --once`
Expected: `convex/_generated` updates; no schema errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json convex/schema.ts
git commit -m "feat: define roadmaps schema and install convex-test"
```

---

### Task 2: Ownership helper and default options

**Files:**
- Modify: `convex/lib/auth.ts`
- Create: `convex/lib/defaults.ts`

- [ ] **Step 1: Add `requireRoadmapOwner`**

Append to `convex/lib/auth.ts`:

```ts
import type { Doc, Id } from "../_generated/dataModel";

/** Verifies the caller owns the roadmap; returns the user id and the roadmap doc. */
export async function requireRoadmapOwner(
	ctx: QueryCtx | MutationCtx,
	roadmapId: Id<"roadmaps">,
): Promise<{ userId: string; roadmap: Doc<"roadmaps"> }> {
	const userId = await requireUser(ctx);
	const roadmap = await ctx.db.get(roadmapId);
	if (!roadmap || roadmap.userId !== userId) {
		throw new Error("Roadmap not found or access denied");
	}
	return { userId, roadmap };
}
```

- [ ] **Step 2: Create `convex/lib/defaults.ts`**

```ts
import type { Infer } from "convex/values";
import type { fieldOptionValidator } from "../schema";

export const STATUS_FIELD_KEY = "status";

export const DEFAULT_STATUS_OPTIONS: Array<Infer<typeof fieldOptionValidator>> = [
	{ id: "planned", label: "Planned", color: "#9bc2e0" },
	{ id: "in_progress", label: "In progress", color: "#e0c79b" },
	{ id: "blocked", label: "Blocked", color: "#e09b9b" },
	{ id: "done", label: "Done", color: "#9bd5a8" },
];
```

- [ ] **Step 3: Commit**

```bash
git add convex/lib/auth.ts convex/lib/defaults.ts
git commit -m "feat: add roadmap ownership helper and default status options"
```

---

### Task 3: Roadmaps functions (TDD)

**Files:**
- Create: `convex/roadmaps.ts`
- Create: `convex/roadmaps.test.ts`

- [ ] **Step 1: Write failing tests**

Create `convex/roadmaps.test.ts`:

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("create seeds a default status field and default lane", async () => {
	const t = convexTest(schema, modules);
	const asAlex = t.withIdentity({ subject: "user_alex" });
	const roadmapId = await asAlex.mutation(api.roadmaps.create, {
		name: "Platform",
		startDate: 0,
		endDate: 1000,
	});
	const bundle = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.roadmap.name).toBe("Platform");
	expect(bundle.roadmap.colorByFieldKey).toBe("status");
	expect(bundle.fields).toHaveLength(1);
	expect(bundle.fields[0].key).toBe("status");
	expect(bundle.fields[0].isSystem).toBe(true);
	expect(bundle.lanes).toHaveLength(1);
	expect(bundle.lanes[0].isDefault).toBe(true);
});

test("getBundle rejects a non-owner", async () => {
	const t = convexTest(schema, modules);
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 1 });
	await expect(
		t.withIdentity({ subject: "user_mallory" }).query(api.roadmaps.getBundle, {
			roadmapId,
		}),
	).rejects.toThrow(/access denied/);
});

test("unauthenticated create is rejected", async () => {
	const t = convexTest(schema, modules);
	await expect(
		t.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 1 }),
	).rejects.toThrow(/Not authenticated/);
});

test("duplicate clones fields, lanes, and items", async () => {
	const t = convexTest(schema, modules);
	const asAlex = t.withIdentity({ subject: "user_alex" });
	const roadmapId = await asAlex.mutation(api.roadmaps.create, {
		name: "R",
		startDate: 0,
		endDate: 1000,
	});
	const bundle = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	await asAlex.mutation(api.items.create, {
		roadmapId,
		laneId: bundle.lanes[0]._id,
		title: "Item A",
		startDate: 10,
		endDate: 20,
		values: { status: "planned" },
	});
	const copyId = await asAlex.mutation(api.roadmaps.duplicate, { roadmapId });
	const copy = await asAlex.query(api.roadmaps.getBundle, { roadmapId: copyId });
	expect(copy.roadmap.name).toBe("R (copy)");
	expect(copy.fields).toHaveLength(1);
	expect(copy.lanes).toHaveLength(1);
	expect(copy.items).toHaveLength(1);
	expect(copy.items[0].title).toBe("Item A");
	expect(copy.items[0]._id).not.toBe(bundle.lanes[0]._id);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/roadmaps.test.ts`
Expected: FAIL — `api.roadmaps.create` undefined.

- [ ] **Step 3: Implement `convex/roadmaps.ts`**

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireRoadmapOwner, requireUser } from "./lib/auth";
import { DEFAULT_STATUS_OPTIONS, STATUS_FIELD_KEY } from "./lib/defaults";
import { zoomValidator } from "./schema";

const byOrder = <T extends { order: number }>(rows: T[]): T[] =>
	[...rows].sort((a, b) => a.order - b.order);

async function loadChildren(
	ctx: Parameters<typeof requireRoadmapOwner>[0],
	roadmapId: Id<"roadmaps">,
) {
	const [fields, lanes, items, milestones] = await Promise.all([
		ctx.db.query("fields").withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId)).collect(),
		ctx.db.query("lanes").withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId)).collect(),
		ctx.db.query("items").withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId)).collect(),
		ctx.db.query("milestones").withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId)).collect(),
	]);
	return { fields: byOrder(fields), lanes: byOrder(lanes), items: byOrder(items), milestones };
}

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		return await ctx.db
			.query("roadmaps")
			.withIndex("by_user_archived", (q) => q.eq("userId", userId).eq("archived", false))
			.collect();
	},
});

export const get = query({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		const { roadmap } = await requireRoadmapOwner(ctx, args.roadmapId);
		return roadmap;
	},
});

export const getBundle = query({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		const { roadmap } = await requireRoadmapOwner(ctx, args.roadmapId);
		return { roadmap, ...(await loadChildren(ctx, args.roadmapId)) };
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		startDate: v.number(),
		endDate: v.number(),
		defaultZoom: v.optional(zoomValidator),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		const roadmapId = await ctx.db.insert("roadmaps", {
			userId,
			name: args.name,
			description: args.description,
			startDate: args.startDate,
			endDate: args.endDate,
			defaultZoom: args.defaultZoom ?? "month",
			colorByFieldKey: STATUS_FIELD_KEY,
			visibility: "private",
			archived: false,
		});
		await ctx.db.insert("fields", {
			roadmapId,
			userId,
			key: STATUS_FIELD_KEY,
			label: "Status",
			type: "select",
			options: DEFAULT_STATUS_OPTIONS,
			order: 0,
			showInTable: true,
			isSystem: true,
		});
		await ctx.db.insert("lanes", {
			roadmapId,
			userId,
			name: "General",
			order: 0,
			isDefault: true,
		});
		return roadmapId;
	},
});

export const update = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		defaultZoom: v.optional(zoomValidator),
		colorByFieldKey: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireRoadmapOwner(ctx, args.roadmapId);
		const { roadmapId, ...patch } = args;
		await ctx.db.patch(roadmapId, patch);
	},
});

export const archive = mutation({
	args: { roadmapId: v.id("roadmaps"), archived: v.boolean() },
	handler: async (ctx, args) => {
		await requireRoadmapOwner(ctx, args.roadmapId);
		await ctx.db.patch(args.roadmapId, { archived: args.archived });
	},
});

export const enableShare = mutation({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		const { roadmap } = await requireRoadmapOwner(ctx, args.roadmapId);
		const token = roadmap.shareToken ?? crypto.randomUUID().replace(/-/g, "");
		await ctx.db.patch(args.roadmapId, { visibility: "link", shareToken: token });
		return token;
	},
});

export const disableShare = mutation({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		await requireRoadmapOwner(ctx, args.roadmapId);
		await ctx.db.patch(args.roadmapId, { visibility: "private", shareToken: undefined });
	},
});

export const duplicate = mutation({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		const { userId, roadmap } = await requireRoadmapOwner(ctx, args.roadmapId);
		const children = await loadChildren(ctx, args.roadmapId);
		const newId = await ctx.db.insert("roadmaps", {
			userId,
			name: `${roadmap.name} (copy)`,
			description: roadmap.description,
			startDate: roadmap.startDate,
			endDate: roadmap.endDate,
			defaultZoom: roadmap.defaultZoom,
			colorByFieldKey: roadmap.colorByFieldKey,
			visibility: "private",
			archived: false,
		});
		for (const f of children.fields) {
			await ctx.db.insert("fields", {
				roadmapId: newId,
				userId,
				key: f.key,
				label: f.label,
				type: f.type,
				options: f.options,
				order: f.order,
				showInTable: f.showInTable,
				isSystem: f.isSystem,
			});
		}
		const laneIdMap = new Map<Id<"lanes">, Id<"lanes">>();
		for (const l of children.lanes) {
			const cloneId = await ctx.db.insert("lanes", {
				roadmapId: newId,
				userId,
				name: l.name,
				color: l.color,
				order: l.order,
				isDefault: l.isDefault,
			});
			laneIdMap.set(l._id, cloneId);
		}
		for (const it of children.items) {
			await ctx.db.insert("items", {
				roadmapId: newId,
				laneId: laneIdMap.get(it.laneId) as Id<"lanes">,
				userId,
				title: it.title,
				startDate: it.startDate,
				endDate: it.endDate,
				description: it.description,
				values: it.values,
				order: it.order,
			});
		}
		for (const m of children.milestones) {
			await ctx.db.insert("milestones", {
				roadmapId: newId,
				userId,
				name: m.name,
				date: m.date,
				color: m.color,
			});
		}
		return newId;
	},
});

// Silence unused import in environments that tree-shake types.
export type RoadmapDoc = Doc<"roadmaps">;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/roadmaps.test.ts`
Expected: PASS — 4 tests. (`api.items.create` is needed by the duplicate test; implement Task 5 first if running in strict order, or stub the item via `ctx.db` — but the recommended order is Tasks 3→5 then re-run. See note below.)

> **Ordering note:** the `duplicate` test calls `api.items.create`, which lands in Task 5. Run the first three roadmap tests now (they pass without items); add/enable the `duplicate` test after Task 5. To keep TDD honest, mark the `duplicate` test with `test.skip` here and unskip it at the end of Task 5.

- [ ] **Step 5: Commit**

```bash
git add convex/roadmaps.ts convex/roadmaps.test.ts
git commit -m "feat: roadmaps queries and mutations with ownership checks"
```

---

### Task 4: Fields functions

**Files:**
- Create: `convex/fields.ts`

- [ ] **Step 1: Implement `convex/fields.ts`**

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { fieldOptionValidator, fieldTypeValidator } from "./schema";

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		key: v.string(),
		label: v.string(),
		type: fieldTypeValidator,
		options: v.optional(v.array(fieldOptionValidator)),
		showInTable: v.boolean(),
		order: v.number(),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		const { roadmapId, ...rest } = args;
		return await ctx.db.insert("fields", { roadmapId, userId, ...rest });
	},
});

export const update = mutation({
	args: {
		fieldId: v.id("fields"),
		label: v.optional(v.string()),
		options: v.optional(v.array(fieldOptionValidator)),
		showInTable: v.optional(v.boolean()),
		order: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const field = await ctx.db.get(args.fieldId);
		if (!field) throw new Error("Field not found");
		await requireRoadmapOwner(ctx, field.roadmapId);
		const { fieldId, ...patch } = args;
		await ctx.db.patch(fieldId, patch);
	},
});

export const reorder = mutation({
	args: { fieldId: v.id("fields"), order: v.number() },
	handler: async (ctx, args) => {
		const field = await ctx.db.get(args.fieldId);
		if (!field) throw new Error("Field not found");
		await requireRoadmapOwner(ctx, field.roadmapId);
		await ctx.db.patch(args.fieldId, { order: args.order });
	},
});

export const remove = mutation({
	args: { fieldId: v.id("fields") },
	handler: async (ctx, args) => {
		const field = await ctx.db.get(args.fieldId);
		if (!field) throw new Error("Field not found");
		if (field.isSystem) throw new Error("System fields cannot be deleted");
		await requireRoadmapOwner(ctx, field.roadmapId);
		// Strip this key from every item's values map.
		const items = await ctx.db
			.query("items")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", field.roadmapId))
			.collect();
		for (const item of items) {
			if (field.key in item.values) {
				const { [field.key]: _removed, ...rest } = item.values;
				await ctx.db.patch(item._id, { values: rest });
			}
		}
		await ctx.db.delete(args.fieldId);
	},
});
```

- [ ] **Step 2: Typecheck**

Run: `npx convex dev --once`
Expected: no errors; `api.fields.*` generated.

- [ ] **Step 3: Commit**

```bash
git add convex/fields.ts
git commit -m "feat: custom field create/update/reorder/remove"
```

---

### Task 5: Lanes and items functions (TDD for lane-delete + item move)

**Files:**
- Create: `convex/lanes.ts`
- Create: `convex/items.ts`
- Create: `convex/lanes.test.ts`
- Create: `convex/items.test.ts`

- [ ] **Step 1: Write failing lane tests**

Create `convex/lanes.test.ts`:

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
	const t = convexTest(schema, modules);
	const asAlex = t.withIdentity({ subject: "user_alex" });
	const roadmapId = await asAlex.mutation(api.roadmaps.create, {
		name: "R",
		startDate: 0,
		endDate: 1000,
	});
	return { t, asAlex, roadmapId };
}

test("deleting a lane moves its items to the target lane", async () => {
	const { asAlex, roadmapId } = await setup();
	const bundle = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	const defaultLane = bundle.lanes[0]._id;
	const laneB = await asAlex.mutation(api.lanes.create, { roadmapId, name: "B" });
	await asAlex.mutation(api.items.create, {
		roadmapId,
		laneId: laneB,
		title: "Item",
		startDate: 1,
		endDate: 2,
		values: {},
	});
	await asAlex.mutation(api.lanes.remove, { laneId: laneB, moveToLaneId: defaultLane });
	const after = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	expect(after.lanes).toHaveLength(1);
	expect(after.items[0].laneId).toBe(defaultLane);
});

test("the last lane cannot be deleted", async () => {
	const { asAlex, roadmapId } = await setup();
	const bundle = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	await expect(
		asAlex.mutation(api.lanes.remove, {
			laneId: bundle.lanes[0]._id,
			moveToLaneId: bundle.lanes[0]._id,
		}),
	).rejects.toThrow(/last lane/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run convex/lanes.test.ts`
Expected: FAIL — `api.lanes.create` undefined.

- [ ] **Step 3: Implement `convex/lanes.ts`**

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";

export const create = mutation({
	args: { roadmapId: v.id("roadmaps"), name: v.string(), color: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		const existing = await ctx.db
			.query("lanes")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", args.roadmapId))
			.collect();
		const order = existing.reduce((max, l) => Math.max(max, l.order), -1) + 1;
		return await ctx.db.insert("lanes", {
			roadmapId: args.roadmapId,
			userId,
			name: args.name,
			color: args.color,
			order,
		});
	},
});

export const update = mutation({
	args: {
		laneId: v.id("lanes"),
		name: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const lane = await ctx.db.get(args.laneId);
		if (!lane) throw new Error("Lane not found");
		await requireRoadmapOwner(ctx, lane.roadmapId);
		const { laneId, ...patch } = args;
		await ctx.db.patch(laneId, patch);
	},
});

export const reorder = mutation({
	args: { laneId: v.id("lanes"), order: v.number() },
	handler: async (ctx, args) => {
		const lane = await ctx.db.get(args.laneId);
		if (!lane) throw new Error("Lane not found");
		await requireRoadmapOwner(ctx, lane.roadmapId);
		await ctx.db.patch(args.laneId, { order: args.order });
	},
});

export const remove = mutation({
	args: { laneId: v.id("lanes"), moveToLaneId: v.id("lanes") },
	handler: async (ctx, args) => {
		const lane = await ctx.db.get(args.laneId);
		if (!lane) throw new Error("Lane not found");
		await requireRoadmapOwner(ctx, lane.roadmapId);
		const lanes = await ctx.db
			.query("lanes")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", lane.roadmapId))
			.collect();
		if (lanes.length <= 1) throw new Error("Cannot delete the last lane");
		const target = await ctx.db.get(args.moveToLaneId);
		if (!target || target.roadmapId !== lane.roadmapId) {
			throw new Error("Invalid target lane");
		}
		const items = await ctx.db
			.query("items")
			.withIndex("by_roadmap_lane", (q) =>
				q.eq("roadmapId", lane.roadmapId).eq("laneId", args.laneId),
			)
			.collect();
		for (const item of items) {
			await ctx.db.patch(item._id, { laneId: args.moveToLaneId });
		}
		await ctx.db.delete(args.laneId);
	},
});
```

- [ ] **Step 4: Implement `convex/items.ts`**

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { fieldValueValidator } from "./schema";

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		laneId: v.id("lanes"),
		title: v.string(),
		startDate: v.number(),
		endDate: v.number(),
		description: v.optional(v.string()),
		values: v.record(v.string(), fieldValueValidator),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		const existing = await ctx.db
			.query("items")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", args.roadmapId))
			.collect();
		const order = existing.reduce((max, i) => Math.max(max, i.order), -1) + 1;
		return await ctx.db.insert("items", {
			roadmapId: args.roadmapId,
			laneId: args.laneId,
			userId,
			title: args.title,
			startDate: args.startDate,
			endDate: args.endDate,
			description: args.description,
			values: args.values,
			order,
		});
	},
});

export const update = mutation({
	args: {
		itemId: v.id("items"),
		laneId: v.optional(v.id("lanes")),
		title: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		description: v.optional(v.string()),
		values: v.optional(v.record(v.string(), fieldValueValidator)),
		order: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.itemId);
		if (!item) throw new Error("Item not found");
		await requireRoadmapOwner(ctx, item.roadmapId);
		const { itemId, ...patch } = args;
		await ctx.db.patch(itemId, patch);
	},
});

export const remove = mutation({
	args: { itemId: v.id("items") },
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.itemId);
		if (!item) throw new Error("Item not found");
		await requireRoadmapOwner(ctx, item.roadmapId);
		await ctx.db.delete(args.itemId);
	},
});
```

- [ ] **Step 5: Run lane + roadmap tests; unskip the `duplicate` test**

Remove the `test.skip` from the `duplicate` test in `convex/roadmaps.test.ts` (Task 3), then run:

Run: `npx vitest run convex/lanes.test.ts convex/roadmaps.test.ts`
Expected: PASS — all tests (lane move, last-lane guard, duplicate clones items).

- [ ] **Step 6: Write and run a basic items test**

Create `convex/items.test.ts`:

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("a non-owner cannot create an item", async () => {
	const t = convexTest(schema, modules);
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 100 });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	await expect(
		t.withIdentity({ subject: "user_mallory" }).mutation(api.items.create, {
			roadmapId,
			laneId: bundle.lanes[0]._id,
			title: "x",
			startDate: 0,
			endDate: 1,
			values: {},
		}),
	).rejects.toThrow(/access denied/);
});
```

Run: `npx vitest run convex/items.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add convex/lanes.ts convex/items.ts convex/lanes.test.ts convex/items.test.ts convex/roadmaps.test.ts
git commit -m "feat: lanes and items mutations with move-on-delete"
```

---

### Task 6: Milestones functions

**Files:**
- Create: `convex/milestones.ts`

- [ ] **Step 1: Implement `convex/milestones.ts`**

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		name: v.string(),
		date: v.number(),
		color: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		const { roadmapId, ...rest } = args;
		return await ctx.db.insert("milestones", { roadmapId, userId, ...rest });
	},
});

export const update = mutation({
	args: {
		milestoneId: v.id("milestones"),
		name: v.optional(v.string()),
		date: v.optional(v.number()),
		color: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const milestone = await ctx.db.get(args.milestoneId);
		if (!milestone) throw new Error("Milestone not found");
		await requireRoadmapOwner(ctx, milestone.roadmapId);
		const { milestoneId, ...patch } = args;
		await ctx.db.patch(milestoneId, patch);
	},
});

export const remove = mutation({
	args: { milestoneId: v.id("milestones") },
	handler: async (ctx, args) => {
		const milestone = await ctx.db.get(args.milestoneId);
		if (!milestone) throw new Error("Milestone not found");
		await requireRoadmapOwner(ctx, milestone.roadmapId);
		await ctx.db.delete(args.milestoneId);
	},
});
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm run test`
Expected: PASS — all convex tests + the sanity test.

Run: `npm run check`
Expected: no Biome errors.

- [ ] **Step 3: Commit**

```bash
git add convex/milestones.ts
git commit -m "feat: milestone create/update/remove"
```

---

## Self-review notes

- **Spec coverage:** schema (§3) ✓; all function files (§4) ✓; `getBundle` ✓; auth + ownership on every path ✓; lane move-on-delete + last-lane guard ✓; field removal strips values ✓; `duplicate` ✓; share token mint/clear ✓. `getPublicRoadmap` is intentionally in **Phase 7** (it's the public read path, paired with the share route).
- **Type consistency:** `requireRoadmapOwner` returns `{ userId, roadmap }` and is used that way everywhere. `values` typed as `Record<string, string | number | string[] | null>` via `fieldValueValidator` in both schema and args.
- **App-side `values` validation** (select option ids, number types) lives in `src/lib/fields.ts` (Phase 4) and is applied in the editor before calling `items.create`/`items.update`; the backend stores the validated record. Server-side schema enforces only the coarse value shape.

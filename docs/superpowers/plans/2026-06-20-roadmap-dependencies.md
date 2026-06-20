# Roadmap Item Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users declare visual-only directed dependencies (predecessor → successor) between items within a roadmap, created via an item-panel picker and a timeline drag-to-link, rendered as arrows.

**Architecture:** A new `dependencies` Convex table (one row per edge) flows through the existing `loadRoadmapChildren` bundle so authed and public-share paths get it for free. Pure graph + arrow-geometry logic lives in `src/lib/dependencies.ts` (the unit-test surface). The timeline renders an SVG overlay (`DependencyLayer`). Export/import, snapshots, and duplicate round-trip edges by item index.

**Tech Stack:** Convex (serverless backend, `convex-test` for tests), React 19 + TanStack Start, Vitest, Zod, Biome (tabs, double quotes), date-fns.

**Conventions reminder:**
- Biome: **tab** indentation, **double** quotes. Run `npm run check` before committing.
- After editing anything in `convex/`, run `npx convex dev --once` to regenerate `convex/_generated` and typecheck.
- `npm run test` runs Vitest with esbuild (no type-checking); `npx tsc --noEmit` is the type gate.
- Authed `useQuery` must gate on `useConvexAuth()` with the `"skip"` sentinel (already done in the editor route).
- Direction: `predecessorId` → `successorId` ("successor depends on predecessor"). Arrow drawn predecessor right-edge → successor left-edge.

**Spec:** `docs/superpowers/specs/2026-06-20-roadmap-dependencies-design.md`

---

## Task 1: Schema — `dependencies` table + snapshot validator field

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the `dependencies` table**

In `convex/schema.ts`, inside the `defineSchema({ ... })` object, add this table after the `milestones` table definition:

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

- [ ] **Step 2: Add `dependencies` to the snapshot validator**

In `convex/schema.ts`, inside `roadmapSnapshotValidator`'s object, add this field after the `milestones` array (note: items referenced by index, optional for backward compatibility):

```ts
		dependencies: v.optional(
			v.array(
				v.object({
					predecessorIndex: v.number(),
					successorIndex: v.number(),
				}),
			),
		),
```

- [ ] **Step 3: Regenerate and typecheck**

Run: `npx convex dev --once`
Expected: completes without error; `convex/_generated/dataModel.d.ts` now includes the `dependencies` table.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat(deps): add dependencies table and snapshot field"
```

---

## Task 2: Bundle loads dependencies + TimelineBundle type

**Files:**
- Modify: `convex/lib/bundle.ts`
- Modify: `src/components/timeline/TimelineView.tsx:26-32` (TimelineBundle interface)
- Modify: `src/lib/__tests__/roadmapIO.test.ts` (add `dependencies: []` to fixtures so `tsc` stays green)
- Test: `convex/dependencies.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `convex/dependencies.test.ts`:

```ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup(t: ReturnType<typeof convexTest>) {
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 100 });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	const laneId = bundle.lanes[0]._id;
	const mkItem = (title: string) =>
		t.withIdentity({ subject: "user_alex" }).mutation(api.items.create, {
			roadmapId,
			laneId,
			title,
			startDate: 0,
			endDate: 10,
			values: {},
		});
	return { roadmapId, laneId, mkItem };
}

test("getBundle includes an empty dependencies array", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId } = await setup(t);
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/dependencies.test.ts`
Expected: FAIL — `bundle.dependencies` is `undefined`.

- [ ] **Step 3: Load dependencies in `loadRoadmapChildren`**

In `convex/lib/bundle.ts`, add a fifth query to the `Promise.all` and return it. Replace the `Promise.all` destructuring and the return:

```ts
	const [fields, lanes, items, milestones, dependencies] = await Promise.all([
		ctx.db
			.query("fields")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
		ctx.db
			.query("lanes")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
		ctx.db
			.query("items")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
		ctx.db
			.query("milestones")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
		ctx.db
			.query("dependencies")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
	]);
	return {
		fields: byOrder(fields),
		lanes: byOrder(lanes),
		items: byOrder(items),
		milestones,
		dependencies,
	};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run convex/dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `dependencies` to the `TimelineBundle` type**

In `src/components/timeline/TimelineView.tsx`, update the interface:

```ts
export interface TimelineBundle {
	roadmap: Doc<"roadmaps">;
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	items: Doc<"items">[];
	milestones: Doc<"milestones">[];
	dependencies: Doc<"dependencies">[];
}
```

- [ ] **Step 6: Keep existing roadmapIO test fixtures type-valid**

In `src/lib/__tests__/roadmapIO.test.ts`, add `dependencies: []` to the `bundle` object literal (after the `milestones` line, around line 80):

```ts
		milestones: [] as unknown as Doc<"milestones">[],
		dependencies: [] as unknown as Doc<"dependencies">[],
```

(The other `bundle` literal in that file is already cast `as unknown as TimelineBundle`, so it needs no change.)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add convex/lib/bundle.ts convex/dependencies.test.ts src/components/timeline/TimelineView.tsx src/lib/__tests__/roadmapIO.test.ts
git commit -m "feat(deps): load dependencies into the roadmap bundle"
```

---

## Task 3: Pure logic — `wouldCreateCycle`

**Files:**
- Create: `src/lib/dependencies.ts`
- Test: `src/lib/__tests__/dependencies.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/dependencies.test.ts`:

```ts
import { expect, test } from "vitest";
import { type Edge, wouldCreateCycle } from "../dependencies";

const edges = (pairs: [string, string][]): Edge[] =>
	pairs.map(([predecessorId, successorId]) => ({ predecessorId, successorId }));

test("self-link is reported as a cycle", () => {
	expect(wouldCreateCycle([], "a", "a")).toBe(true);
});

test("a direct reverse edge creates a two-node cycle", () => {
	// a -> b already exists; adding b -> a would cycle.
	expect(wouldCreateCycle(edges([["a", "b"]]), "b", "a")).toBe(true);
});

test("a transitive edge creates a cycle", () => {
	// a -> b -> c exists; adding c -> a would cycle.
	expect(wouldCreateCycle(edges([["a", "b"], ["b", "c"]]), "c", "a")).toBe(true);
});

test("a non-cyclic edge is allowed", () => {
	expect(wouldCreateCycle(edges([["a", "b"]]), "b", "c")).toBe(false);
	expect(wouldCreateCycle(edges([["a", "b"], ["a", "c"]]), "b", "c")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/dependencies.test.ts`
Expected: FAIL — `Cannot find module '../dependencies'`.

- [ ] **Step 3: Implement `wouldCreateCycle`**

Create `src/lib/dependencies.ts`:

```ts
export interface Edge {
	predecessorId: string;
	successorId: string;
}

/**
 * True if adding `predecessorId -> successorId` would create a directed cycle,
 * i.e. the successor can already reach the predecessor (or it's a self-link).
 */
export function wouldCreateCycle(
	edges: Edge[],
	predecessorId: string,
	successorId: string,
): boolean {
	return canReach(edges, successorId, predecessorId);
}

/** Depth-first reachability from `start` to `target` (true when start === target). */
function canReach(edges: Edge[], start: string, target: string): boolean {
	const adjacency = new Map<string, string[]>();
	for (const e of edges) {
		const list = adjacency.get(e.predecessorId);
		if (list) list.push(e.successorId);
		else adjacency.set(e.predecessorId, [e.successorId]);
	}
	const seen = new Set<string>();
	const stack = [start];
	while (stack.length) {
		const node = stack.pop() as string;
		if (node === target) return true;
		if (seen.has(node)) continue;
		seen.add(node);
		for (const next of adjacency.get(node) ?? []) stack.push(next);
	}
	return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dependencies.ts src/lib/__tests__/dependencies.test.ts
git commit -m "feat(deps): add wouldCreateCycle graph helper"
```

---

## Task 4: Pure logic — `dependencyArrows` geometry

**Files:**
- Modify: `src/lib/dependencies.ts`
- Test: `src/lib/__tests__/dependencies.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/dependencies.test.ts`:

```ts
import { dependencyArrows, type ItemRect } from "../dependencies";

const rect = (over: Partial<ItemRect>): ItemRect => ({
	left: 0,
	width: 100,
	top: 0,
	height: 36,
	...over,
});

test("dependencyArrows builds an elbow path from predecessor end to successor start", () => {
	const rects = new Map<string, ItemRect>([
		["a", rect({ left: 0, width: 100, top: 0 })],
		["b", rect({ left: 200, width: 80, top: 50 })],
	]);
	const arrows = dependencyArrows(
		[{ _id: "d1", predecessorId: "a", successorId: "b" }],
		rects,
	);
	expect(arrows).toHaveLength(1);
	// predecessor right-center = (100, 18); successor left-center = (200, 68)
	expect(arrows[0].path).toBe("M 100 18 L 112 18 L 112 68 L 200 68");
	expect(arrows[0].labelX).toBe(112);
	expect(arrows[0].labelY).toBe(43);
	expect(arrows[0].id).toBe("d1");
});

test("dependencyArrows skips edges whose endpoints are not laid out", () => {
	const rects = new Map<string, ItemRect>([["a", rect({})]]);
	const arrows = dependencyArrows(
		[{ _id: "d1", predecessorId: "a", successorId: "missing" }],
		rects,
	);
	expect(arrows).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/dependencies.test.ts`
Expected: FAIL — `dependencyArrows` / `ItemRect` not exported.

- [ ] **Step 3: Implement `dependencyArrows`**

Append to `src/lib/dependencies.ts`:

```ts
export interface ItemRect {
	left: number;
	width: number;
	top: number;
	height: number;
}

export interface DependencyArrow {
	id: string;
	path: string;
	/** Midpoint of the leading stub — anchor for the delete affordance. */
	labelX: number;
	labelY: number;
}

const STUB = 12;

/**
 * SVG elbow connectors from each predecessor's right-center to its successor's
 * left-center. Edges with an endpoint missing from `rects` are skipped (e.g. an
 * item filtered out of the current view).
 */
export function dependencyArrows(
	deps: Array<{ _id: string; predecessorId: string; successorId: string }>,
	rects: Map<string, ItemRect>,
): DependencyArrow[] {
	const arrows: DependencyArrow[] = [];
	for (const dep of deps) {
		const from = rects.get(dep.predecessorId);
		const to = rects.get(dep.successorId);
		if (!from || !to) continue;
		const sx = from.left + from.width;
		const sy = from.top + from.height / 2;
		const ex = to.left;
		const ey = to.top + to.height / 2;
		const stubX = sx + STUB;
		arrows.push({
			id: dep._id,
			path: `M ${sx} ${sy} L ${stubX} ${sy} L ${stubX} ${ey} L ${ex} ${ey}`,
			labelX: stubX,
			labelY: (sy + ey) / 2,
		});
	}
	return arrows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/dependencies.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dependencies.ts src/lib/__tests__/dependencies.test.ts
git commit -m "feat(deps): add dependencyArrows geometry helper"
```

---

## Task 5: Backend — `dependencies.create` mutation

**Files:**
- Create: `convex/dependencies.ts`
- Test: `convex/dependencies.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `convex/dependencies.test.ts`:

```ts
test("create adds a dependency visible in the bundle", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toHaveLength(1);
	expect(bundle.dependencies[0].predecessorId).toBe(a);
	expect(bundle.dependencies[0].successorId).toBe(b);
});

test("create rejects self-links, duplicates, cycles, and non-owners", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	const call = (predecessorId: typeof a, successorId: typeof b) =>
		t
			.withIdentity({ subject: "user_alex" })
			.mutation(api.dependencies.create, {
				roadmapId,
				predecessorId,
				successorId,
			});

	await expect(call(a, a)).rejects.toThrow(/self/i);
	await call(a, b);
	await expect(call(a, b)).rejects.toThrow(/already exists/i);
	await expect(call(b, a)).rejects.toThrow(/cycle/i);
	await expect(
		t
			.withIdentity({ subject: "user_mallory" })
			.mutation(api.dependencies.create, {
				roadmapId,
				predecessorId: a,
				successorId: b,
			}),
	).rejects.toThrow(/access denied/);
});

test("create rejects items from a different roadmap", async () => {
	const t = convexTest(schema, modules);
	const first = await setup(t);
	const second = await setup(t);
	const a = await first.mkItem("A");
	const foreign = await second.mkItem("Foreign");
	await expect(
		t
			.withIdentity({ subject: "user_alex" })
			.mutation(api.dependencies.create, {
				roadmapId: first.roadmapId,
				predecessorId: a,
				successorId: foreign,
			}),
	).rejects.toThrow(/not in this roadmap/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/dependencies.test.ts`
Expected: FAIL — `api.dependencies.create` does not exist.

- [ ] **Step 3: Implement `create`**

Create `convex/dependencies.ts`:

```ts
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";

/** True if `start` can already reach `target` along existing edges. */
function canReach(
	edges: Doc<"dependencies">[],
	start: Id<"items">,
	target: Id<"items">,
): boolean {
	const adjacency = new Map<string, Id<"items">[]>();
	for (const e of edges) {
		const list = adjacency.get(e.predecessorId);
		if (list) list.push(e.successorId);
		else adjacency.set(e.predecessorId, [e.successorId]);
	}
	const seen = new Set<string>();
	const stack: Id<"items">[] = [start];
	while (stack.length) {
		const node = stack.pop() as Id<"items">;
		if (node === target) return true;
		if (seen.has(node)) continue;
		seen.add(node);
		for (const next of adjacency.get(node) ?? []) stack.push(next);
	}
	return false;
}

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		predecessorId: v.id("items"),
		successorId: v.id("items"),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		if (args.predecessorId === args.successorId) {
			throw new Error("An item cannot depend on itself");
		}
		const [pred, succ] = await Promise.all([
			ctx.db.get(args.predecessorId),
			ctx.db.get(args.successorId),
		]);
		if (
			!pred ||
			!succ ||
			pred.roadmapId !== args.roadmapId ||
			succ.roadmapId !== args.roadmapId
		) {
			throw new Error("Both items must be in this roadmap");
		}
		const existing = await ctx.db
			.query("dependencies")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", args.roadmapId))
			.collect();
		if (
			existing.some(
				(d) =>
					d.predecessorId === args.predecessorId &&
					d.successorId === args.successorId,
			)
		) {
			throw new Error("This dependency already exists");
		}
		// Adding pred -> succ cycles iff succ can already reach pred.
		if (canReach(existing, args.successorId, args.predecessorId)) {
			throw new Error("This dependency would create a cycle");
		}
		return await ctx.db.insert("dependencies", {
			roadmapId: args.roadmapId,
			userId,
			predecessorId: args.predecessorId,
			successorId: args.successorId,
		});
	},
});
```

- [ ] **Step 4: Regenerate API + run tests**

Run: `npx convex dev --once && npx vitest run convex/dependencies.test.ts`
Expected: PASS (all create tests).

- [ ] **Step 5: Commit**

```bash
git add convex/dependencies.ts convex/dependencies.test.ts convex/_generated
git commit -m "feat(deps): add dependencies.create with cycle/self/dup guards"
```

---

## Task 6: Backend — `dependencies.remove` mutation

**Files:**
- Modify: `convex/dependencies.ts`
- Test: `convex/dependencies.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `convex/dependencies.test.ts`:

```ts
test("remove deletes a dependency", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	const depId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.remove, { dependencyId: depId });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/dependencies.test.ts`
Expected: FAIL — `api.dependencies.remove` does not exist.

- [ ] **Step 3: Implement `remove`**

Append to `convex/dependencies.ts`:

```ts
export const remove = mutation({
	args: { dependencyId: v.id("dependencies") },
	handler: async (ctx, args) => {
		const dep = await ctx.db.get(args.dependencyId);
		if (!dep) throw new Error("Dependency not found");
		await requireRoadmapOwner(ctx, dep.roadmapId);
		await ctx.db.delete(args.dependencyId);
	},
});
```

- [ ] **Step 4: Regenerate API + run test**

Run: `npx convex dev --once && npx vitest run convex/dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/dependencies.ts convex/dependencies.test.ts convex/_generated
git commit -m "feat(deps): add dependencies.remove"
```

---

## Task 7: Backend — cascade-delete dependencies on item removal

**Files:**
- Modify: `convex/items.ts:57-65` (the `remove` mutation)
- Test: `convex/dependencies.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `convex/dependencies.test.ts`:

```ts
test("deleting an item removes dependencies referencing it", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	const c = await mkItem("C");
	// a -> b (b is successor), b -> c (b is predecessor)
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: b,
			successorId: c,
		});
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.items.remove, { itemId: b });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/dependencies.test.ts`
Expected: FAIL — the two dependencies survive item deletion.

- [ ] **Step 3: Add cascade-delete to `items.remove`**

In `convex/items.ts`, replace the `remove` handler body so it deletes referencing dependencies before deleting the item:

```ts
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.itemId);
		if (!item) throw new Error("Item not found");
		await requireRoadmapOwner(ctx, item.roadmapId);
		const [asPred, asSucc] = await Promise.all([
			ctx.db
				.query("dependencies")
				.withIndex("by_predecessor", (q) =>
					q.eq("predecessorId", args.itemId),
				)
				.collect(),
			ctx.db
				.query("dependencies")
				.withIndex("by_successor", (q) => q.eq("successorId", args.itemId))
				.collect(),
		]);
		for (const dep of [...asPred, ...asSucc]) {
			await ctx.db.delete(dep._id);
		}
		await ctx.db.delete(args.itemId);
	},
```

- [ ] **Step 4: Regenerate + run test**

Run: `npx convex dev --once && npx vitest run convex/dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/items.ts convex/dependencies.test.ts convex/_generated
git commit -m "feat(deps): cascade-delete dependencies when an item is removed"
```

---

## Task 8: Snapshots — serialize & restore dependencies by index

**Files:**
- Modify: `convex/lib/snapshot.ts`
- Test: `convex/dependencies.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `convex/dependencies.test.ts`:

```ts
test("dependencies survive a version snapshot + restore", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.create, { roadmapId, label: "snap" });
	// Mutate current state: delete the dependency.
	const mid = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.remove, {
			dependencyId: mid.dependencies[0]._id,
		});
	const versions = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	const snap = versions.find((v) => v.label === "snap");
	if (!snap) throw new Error("snapshot missing");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.restore, { versionId: snap._id });
	const after = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(after.dependencies).toHaveLength(1);
	const itemTitle = (id: typeof a) =>
		after.items.find((i) => i._id === id)?.title;
	expect(itemTitle(after.dependencies[0].predecessorId)).toBe("A");
	expect(itemTitle(after.dependencies[0].successorId)).toBe("B");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/dependencies.test.ts`
Expected: FAIL — restored bundle has no dependencies.

- [ ] **Step 3: Serialize dependencies in `snapshotRoadmap`**

In `convex/lib/snapshot.ts`, inside `snapshotRoadmap`: destructure `dependencies` from `loadRoadmapChildren`, build an item-index map, and emit the array.

Change the destructure line:

```ts
	const { fields, lanes, items, milestones, dependencies } =
		await loadRoadmapChildren(ctx, roadmapId);
```

Add an item-index map after the `laneIndex` map:

```ts
	const itemIndex = new Map<Id<"items">, number>();
	items.forEach((item, i) => itemIndex.set(item._id, i));
```

Add to the returned object, after the `milestones` array:

```ts
		dependencies: dependencies
			.filter(
				(d) =>
					itemIndex.has(d.predecessorId) && itemIndex.has(d.successorId),
			)
			.map((d) => ({
				predecessorIndex: itemIndex.get(d.predecessorId) as number,
				successorIndex: itemIndex.get(d.successorId) as number,
			})),
```

- [ ] **Step 4: Rebuild dependencies in `applySnapshot`**

In `convex/lib/snapshot.ts`, `applySnapshot`:

(a) Delete existing dependencies along with the other children. Replace the deletion loop's array with:

```ts
		for (const row of [
			...existing.fields,
			...existing.lanes,
			...existing.items,
			...existing.milestones,
			...existing.dependencies,
		]) {
			await ctx.db.delete(row._id);
		}
```

(b) Track inserted item ids. Change the item insertion loop to collect ids:

```ts
		const itemIds: Id<"items">[] = [];
		for (const it of snapshot.items) {
			const laneId = laneIds[it.laneIndex] ?? laneIds[0];
			const id = await ctx.db.insert("items", {
				roadmapId,
				laneId,
				userId,
				title: it.title,
				startDate: it.startDate,
				endDate: it.endDate,
				description: it.description,
				values: it.values,
				order: it.order,
			});
			itemIds.push(id);
		}
```

(c) After the milestones insertion loop, rebuild dependencies:

```ts
		for (const d of snapshot.dependencies ?? []) {
			const predecessorId = itemIds[d.predecessorIndex];
			const successorId = itemIds[d.successorIndex];
			if (!predecessorId || !successorId) continue;
			await ctx.db.insert("dependencies", {
				roadmapId,
				userId,
				predecessorId,
				successorId,
			});
		}
```

- [ ] **Step 5: Regenerate + run test**

Run: `npx convex dev --once && npx vitest run convex/dependencies.test.ts`
Expected: PASS. Also run the existing versioning suite to confirm no regression: `npx vitest run convex/roadmapVersions.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/lib/snapshot.ts convex/dependencies.test.ts convex/_generated
git commit -m "feat(deps): round-trip dependencies through snapshots"
```

---

## Task 9: Duplicate — clone dependencies

**Files:**
- Modify: `convex/roadmaps.ts:140-206` (the `duplicate` mutation)
- Test: `convex/dependencies.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `convex/dependencies.test.ts`:

```ts
test("duplicate clones dependencies onto the new items", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, mkItem } = await setup(t);
	const a = await mkItem("A");
	const b = await mkItem("B");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.dependencies.create, {
			roadmapId,
			predecessorId: a,
			successorId: b,
		});
	const newId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.duplicate, { roadmapId });
	const copy = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId: newId });
	expect(copy.dependencies).toHaveLength(1);
	const title = (id: (typeof copy.items)[number]["_id"]) =>
		copy.items.find((i) => i._id === id)?.title;
	expect(title(copy.dependencies[0].predecessorId)).toBe("A");
	expect(title(copy.dependencies[0].successorId)).toBe("B");
	// The clone references the NEW items, not the originals.
	expect(copy.dependencies[0].predecessorId).not.toBe(a);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/dependencies.test.ts`
Expected: FAIL — the copy has no dependencies.

- [ ] **Step 3: Clone dependencies in `duplicate`**

In `convex/roadmaps.ts`, `duplicate`:

(a) Build an item-id map. Replace the item-cloning loop:

```ts
		const itemIdMap = new Map<Id<"items">, Id<"items">>();
		for (const it of children.items) {
			const cloneId = await ctx.db.insert("items", {
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
			itemIdMap.set(it._id, cloneId);
		}
```

(b) After the milestones-cloning loop (before `return newId;`), add:

```ts
		for (const d of children.dependencies) {
			const predecessorId = itemIdMap.get(d.predecessorId);
			const successorId = itemIdMap.get(d.successorId);
			if (!predecessorId || !successorId) continue;
			await ctx.db.insert("dependencies", {
				roadmapId: newId,
				userId,
				predecessorId,
				successorId,
			});
		}
```

- [ ] **Step 4: Regenerate + run test**

Run: `npx convex dev --once && npx vitest run convex/dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/roadmaps.ts convex/dependencies.test.ts convex/_generated
git commit -m "feat(deps): clone dependencies when duplicating a roadmap"
```

---

## Task 10: Export / import — dependencies by item index

**Files:**
- Modify: `src/lib/roadmapIO.ts`
- Modify: `convex/io.ts` is unaffected (uses snapshot validator, already done in Task 8). No change needed there.
- Test: `src/lib/__tests__/roadmapIO.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/roadmapIO.test.ts`:

```ts
test("serializeRoadmap emits dependencies by item index and round-trips", () => {
	const withDeps = {
		...bundle,
		items: [
			{ ...bundle.items[0], _id: "i1" },
			{ ...bundle.items[0], _id: "i2", title: "Item 2" },
		] as unknown as (typeof bundle)["items"],
		dependencies: [
			{
				_id: "d1",
				_creationTime: 0,
				roadmapId: "r1",
				userId: "u",
				predecessorId: "i1",
				successorId: "i2",
			},
		] as unknown as (typeof bundle)["dependencies"],
	};
	const out = serializeRoadmap(withDeps);
	expect(out.dependencies).toEqual([
		{ predecessorIndex: 0, successorIndex: 1 },
	]);
	const parsed = parseImport(JSON.stringify(out));
	expect(parsed.dependencies).toEqual([
		{ predecessorIndex: 0, successorIndex: 1 },
	]);
});

test("parseImport accepts payloads without a dependencies field", () => {
	const out = serializeRoadmap(bundle);
	const { dependencies: _drop, ...noDeps } = out;
	const parsed = parseImport(JSON.stringify(noDeps));
	expect(parsed.dependencies).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/roadmapIO.test.ts`
Expected: FAIL — `out.dependencies` is `undefined`.

- [ ] **Step 3: Add the schema field**

In `src/lib/roadmapIO.ts`, inside `roadmapExportSchema`, add after the `milestones` array (before the closing `})`):

```ts
	dependencies: z
		.array(
			z.object({
				predecessorIndex: z.number(),
				successorIndex: z.number(),
			}),
		)
		.optional(),
```

- [ ] **Step 4: Emit dependencies in `serializeRoadmap`**

In `src/lib/roadmapIO.ts`, `serializeRoadmap`: build an item-index map and add the field to the returned object.

After the `laneIndex` map setup, add:

```ts
	const itemIndex = new Map<Doc<"items">["_id"], number>();
	bundle.items.forEach((item, i) => {
		itemIndex.set(item._id, i);
	});
```

In the returned object, after the `milestones` mapping, add:

```ts
		dependencies: bundle.dependencies
			.filter(
				(d) =>
					itemIndex.has(d.predecessorId) && itemIndex.has(d.successorId),
			)
			.map((d) => ({
				predecessorIndex: itemIndex.get(d.predecessorId) as number,
				successorIndex: itemIndex.get(d.successorId) as number,
			})),
```

(No change needed in `parseImport` — the optional field passes through Zod unchanged.)

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/lib/__tests__/roadmapIO.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/roadmapIO.ts src/lib/__tests__/roadmapIO.test.ts
git commit -m "feat(deps): export/import dependencies by item index"
```

---

## Task 11: Rendering — `DependencyLayer` + TimelineView rect map

**Files:**
- Create: `src/components/timeline/DependencyLayer.tsx`
- Modify: `src/components/timeline/TimelineView.tsx`
- Test: `src/components/timeline/__tests__/DependencyLayer.test.tsx` (new)

- [ ] **Step 1: Write the failing component test**

Create `src/components/timeline/__tests__/DependencyLayer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import type { ItemRect } from "@/lib/dependencies";
import { DependencyLayer } from "../DependencyLayer";

test("renders one path per resolvable dependency", () => {
	const rects = new Map<string, ItemRect>([
		["a", { left: 0, width: 100, top: 0, height: 36 }],
		["b", { left: 200, width: 80, top: 50, height: 36 }],
	]);
	const { container } = render(
		<DependencyLayer
			deps={[
				{ _id: "d1", predecessorId: "a", successorId: "b" },
				{ _id: "d2", predecessorId: "a", successorId: "missing" },
			]}
			rects={rects}
			width={400}
			height={200}
		/>,
	);
	expect(container.querySelectorAll("path[data-dep]")).toHaveLength(1);
});

test("renders a delete affordance only when onRemove is provided", () => {
	const rects = new Map<string, ItemRect>([
		["a", { left: 0, width: 100, top: 0, height: 36 }],
		["b", { left: 200, width: 80, top: 0, height: 36 }],
	]);
	const deps = [{ _id: "d1", predecessorId: "a", successorId: "b" }];
	const readOnly = render(
		<DependencyLayer deps={deps} rects={rects} width={400} height={200} />,
	);
	expect(
		readOnly.container.querySelectorAll("[data-dep-delete]"),
	).toHaveLength(0);
	const editable = render(
		<DependencyLayer
			deps={deps}
			rects={rects}
			width={400}
			height={200}
			onRemove={() => {}}
		/>,
	);
	expect(
		editable.container.querySelectorAll("[data-dep-delete]"),
	).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/timeline/__tests__/DependencyLayer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DependencyLayer`**

Create `src/components/timeline/DependencyLayer.tsx`:

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import { dependencyArrows, type ItemRect } from "@/lib/dependencies";

export function DependencyLayer({
	deps,
	rects,
	width,
	height,
	onRemove,
}: {
	deps: Array<
		Pick<Doc<"dependencies">, "_id" | "predecessorId" | "successorId">
	>;
	rects: Map<string, ItemRect>;
	width: number;
	height: number;
	onRemove?: (dependencyId: Doc<"dependencies">["_id"]) => void;
}) {
	const arrows = dependencyArrows(deps, rects);
	return (
		<svg
			className="pointer-events-none absolute left-0 top-0"
			width={width}
			height={height}
			aria-hidden="true"
		>
			<defs>
				<marker
					id="dep-arrow"
					markerWidth="8"
					markerHeight="8"
					refX="6"
					refY="3"
					orient="auto"
					markerUnits="userSpaceOnUse"
				>
					<path d="M0,0 L6,3 L0,6 Z" fill="var(--rm-dep, #6b7280)" />
				</marker>
			</defs>
			{arrows.map((arrow) => (
				<g key={arrow.id} className="group/dep">
					<path
						data-dep
						d={arrow.path}
						fill="none"
						stroke="var(--rm-dep, #6b7280)"
						strokeWidth={1.5}
						markerEnd="url(#dep-arrow)"
					/>
					{onRemove ? (
						<g
							data-dep-delete
							className="pointer-events-auto cursor-pointer opacity-0 transition-opacity hover:opacity-100 group-hover/dep:opacity-100"
							onClick={() => onRemove(arrow.id as Doc<"dependencies">["_id"])}
						>
							<circle
								cx={arrow.labelX}
								cy={arrow.labelY}
								r={7}
								fill="white"
								stroke="var(--rm-dep, #6b7280)"
							/>
							<path
								d={`M ${arrow.labelX - 3} ${arrow.labelY - 3} L ${arrow.labelX + 3} ${arrow.labelY + 3} M ${arrow.labelX + 3} ${arrow.labelY - 3} L ${arrow.labelX - 3} ${arrow.labelY + 3}`}
								stroke="var(--rm-dep, #6b7280)"
								strokeWidth={1.2}
							/>
						</g>
					) : null}
				</g>
			))}
		</svg>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/timeline/__tests__/DependencyLayer.test.tsx`
Expected: PASS. (If `@testing-library/react` is not installed, check `package.json`; component tests like `src/components/__tests__/ToolCard.test.tsx` already use it, so it is available.)

- [ ] **Step 5: Build the item-rect map and render the layer in TimelineView**

In `src/components/timeline/TimelineView.tsx`:

(a) Add imports — extend the existing `@/lib/timeline` import is not needed; add a new import and the `Id` type. At the top add:

```tsx
import type { ItemRect } from "@/lib/dependencies";
import { DependencyLayer } from "./DependencyLayer";
```

(b) Add an `onRemoveDependency` prop to the component signature (alongside the others), typed:

```tsx
	onRemoveDependency?: (id: Doc<"dependencies">["_id"]) => void;
```

and destructure `dependencies` from `bundle`:

```tsx
	const { roadmap, fields, lanes, items, milestones, dependencies } = bundle;
```

(c) After the `layout`/`totalHeight` memos, add the rect map:

```tsx
	const itemRects = useMemo(() => {
		const map = new Map<string, ItemRect>();
		for (const lane of lanes) {
			const laneItems = items.filter((i) => i.laneId === lane._id);
			const rows = packLanes(laneItems);
			const bound = layout.find((b) => b.laneId === lane._id);
			laneItems.forEach((it, i) => {
				const g = itemGeometry(it, windowStart, windowEnd, axisWidth);
				map.set(it._id, {
					left: g.left,
					width: g.width,
					top: (bound?.top ?? 0) + rows[i] * (ROW_HEIGHT + ROW_GAP) + ROW_GAP,
					height: ROW_HEIGHT,
				});
			});
		}
		return map;
	}, [lanes, items, layout, windowStart, windowEnd, axisWidth]);
```

(d) Render the layer inside the overlay div (the one with `left: LABEL_WIDTH, width: axisWidth, height: totalHeight`), as the first child, before the `guideX` block:

```tsx
						<DependencyLayer
							deps={dependencies}
							rects={itemRects}
							width={axisWidth}
							height={totalHeight}
							onRemove={editable ? onRemoveDependency : undefined}
						/>
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: no errors. (`onRemoveDependency` is wired in Task 13; until then it is simply `undefined`, which is valid.)

- [ ] **Step 7: Commit**

```bash
git add src/components/timeline/DependencyLayer.tsx src/components/timeline/TimelineView.tsx src/components/timeline/__tests__/DependencyLayer.test.tsx
git commit -m "feat(deps): render dependency arrows on the timeline"
```

---

## Task 12: Item panel — "Depends on" predecessor picker

**Files:**
- Modify: `src/components/panel/ItemEditorPanel.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` (pass `items` + `dependencies` to the panel)

- [ ] **Step 1: Pass data into the panel from the route**

In `src/routes/roadmaps/$id.tsx`, update the `<ItemEditorPanel ... />` props to also pass the full item list and dependencies:

```tsx
				<ItemEditorPanel
					roadmapId={roadmapId}
					item={editingItem}
					fields={bundle.fields}
					lanes={bundle.lanes}
					allItems={bundle.items}
					dependencies={bundle.dependencies}
					windowStart={bundle.roadmap.startDate}
					presetLaneId={newItem?.laneId}
					presetStartMs={newItem?.startMs}
					onClose={() => {
						setEditing(null);
						setNewItem(null);
					}}
				/>
```

- [ ] **Step 2: Extend the panel props + mutations**

In `src/components/panel/ItemEditorPanel.tsx`:

(a) Add imports:

```tsx
import type { Doc } from "@convex/_generated/dataModel";
```

(`Doc` may already be imported alongside `Id` — if so, merge into the existing import.)

(b) Add `allItems` and `dependencies` to the component props signature:

```tsx
	allItems: Doc<"items">[];
	dependencies: Doc<"dependencies">[];
```

(c) Add the dependency mutations next to the existing ones:

```tsx
	const createDependency = useMutation(api.dependencies.create);
	const removeDependency = useMutation(api.dependencies.remove);
	const [depError, setDepError] = useState<string | null>(null);
```

- [ ] **Step 3: Compute current predecessors and the toggle handler**

In `ItemEditorPanel`, after the `set` helper and before the `return`, add (only meaningful when editing an existing `item`):

```tsx
	const predecessorIds = new Set(
		item
			? dependencies
					.filter((d) => d.successorId === item._id)
					.map((d) => d.predecessorId)
			: [],
	);

	async function togglePredecessor(predecessorId: Id<"items">) {
		if (!item) return;
		setDepError(null);
		const existing = dependencies.find(
			(d) => d.successorId === item._id && d.predecessorId === predecessorId,
		);
		try {
			if (existing) {
				await removeDependency({ dependencyId: existing._id });
			} else {
				await createDependency({
					roadmapId,
					predecessorId,
					successorId: item._id,
				});
			}
		} catch (e) {
			setDepError(e instanceof Error ? e.message : "Could not update dependency");
		}
	}
```

- [ ] **Step 4: Render the picker**

In `ItemEditorPanel`, inside the scrollable body (after the Description `<label>` block, before the `{error ? ...}` line), add the picker — shown only for saved items:

```tsx
					{item ? (
						<div className="block text-sm">
							<span className="text-neutral-700">Depends on</span>
							<div className="mt-1 max-h-40 space-y-1 overflow-auto rounded-md border border-neutral-200 p-2">
								{allItems.filter((other) => other._id !== item._id).length ===
								0 ? (
									<p className="text-xs text-neutral-500">No other items</p>
								) : (
									allItems
										.filter((other) => other._id !== item._id)
										.map((other) => (
											<label
												key={other._id}
												className="flex items-center gap-2 text-xs"
											>
												<input
													type="checkbox"
													checked={predecessorIds.has(other._id)}
													onChange={() => togglePredecessor(other._id)}
												/>
												<span className="truncate">{other.title}</span>
											</label>
										))
								)}
							</div>
							{depError ? (
								<p className="mt-1 text-xs text-red-600">{depError}</p>
							) : null}
						</div>
					) : null}
```

- [ ] **Step 5: Typecheck, lint, build**

Run: `npx tsc --noEmit && npm run check && npm run build`
Expected: all pass.

- [ ] **Step 6: Manual verification**

Start both processes (`npx convex dev` and `npm run dev`), open a roadmap with ≥2 items, open an item, check another item under "Depends on". Expected: an arrow appears on the timeline from the predecessor to this item; unchecking removes it. Try checking an item that would form a cycle — expect the inline error "This dependency would create a cycle".

- [ ] **Step 7: Commit**

```bash
git add src/components/panel/ItemEditorPanel.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat(deps): add Depends-on picker to the item panel"
```

---

## Task 13: Timeline — drag-to-link handle + arrow delete wiring

**Files:**
- Modify: `src/components/timeline/ItemBar.tsx`
- Modify: `src/components/timeline/LaneRow.tsx` (forward link callbacks)
- Modify: `src/components/timeline/TimelineView.tsx` (resolve drop target, wire create/remove)
- Modify: `src/routes/roadmaps/$id.tsx` (pass create/remove mutations to TimelineView)

- [ ] **Step 1: Add a link handle + link-drag gesture to `ItemBar`**

In `src/components/timeline/ItemBar.tsx`:

(a) Add two props to the signature:

```tsx
	onLinkDrag?: (clientX: number, clientY: number) => void;
	onLinkCommit?: (clientX: number, clientY: number) => void;
```

(b) Add a ref to track a link drag, near the existing `drag` ref:

```tsx
	const linking = useRef(false);
```

(c) Add handlers for the link handle (place these functions next to `begin`/`move`/`end`):

```tsx
	function linkBegin(e: React.PointerEvent) {
		if (!onLinkCommit) return;
		e.preventDefault();
		e.stopPropagation();
		(e.target as Element).setPointerCapture(e.pointerId);
		linking.current = true;
	}

	function linkMove(e: React.PointerEvent) {
		if (!linking.current) return;
		e.stopPropagation();
		onLinkDrag?.(e.clientX, e.clientY);
	}

	function linkEnd(e: React.PointerEvent) {
		if (!linking.current) return;
		e.stopPropagation();
		linking.current = false;
		onLinkCommit?.(e.clientX, e.clientY);
	}
```

(d) Render the link handle inside the bar (only when editable), after the resize-end span. Use a visible dot on the right side:

```tsx
				{onLinkCommit ? (
					<span
						aria-label="Link to another item"
						onPointerDown={linkBegin}
						onPointerMove={linkMove}
						onPointerUp={linkEnd}
						className="absolute -right-1 top-1/2 hidden h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border border-neutral-400 bg-white group-hover:block"
					/>
				) : null}
```

- [ ] **Step 2: Forward link callbacks through `LaneRow`**

In `src/components/timeline/LaneRow.tsx`:

(a) Add to the props signature:

```tsx
	onItemLinkDrag?: (clientX: number, clientY: number) => void;
	onItemLinkCommit?: (
		item: Doc<"items">,
		clientX: number,
		clientY: number,
	) => void;
```

(b) Pass them to each `<ItemBar>`:

```tsx
							onLinkDrag={onItemLinkDrag}
							onLinkCommit={
								onItemLinkCommit
									? (x, y) => onItemLinkCommit(item, x, y)
									: undefined
							}
```

- [ ] **Step 3: Resolve drop target and wire create/remove in `TimelineView`**

In `src/components/timeline/TimelineView.tsx`:

(a) Add an `onCreateDependency` prop:

```tsx
	onCreateDependency?: (
		predecessorId: Doc<"items">["_id"],
		successorId: Doc<"items">["_id"],
	) => void;
```

(b) Add a helper that maps client coords → item id using `itemRects` and the `lanesRef` offset. Add near `handleItemDrag`:

```tsx
	const itemAtClient = (clientX: number, clientY: number) => {
		const el = lanesRef.current;
		if (!el) return null;
		const box = el.getBoundingClientRect();
		const x = clientX - box.left - LABEL_WIDTH;
		const y = clientY - box.top;
		for (const [id, r] of itemRects) {
			if (
				x >= r.left &&
				x <= r.left + r.width &&
				y >= r.top &&
				y <= r.top + r.height
			) {
				return id;
			}
		}
		return null;
	};

	const handleItemLinkCommit = onCreateDependency
		? (item: Doc<"items">, clientX: number, clientY: number) => {
				const targetId = itemAtClient(clientX, clientY);
				if (targetId && targetId !== item._id) {
					onCreateDependency(
						item._id,
						targetId as Doc<"items">["_id"],
					);
				}
			}
		: undefined;
```

(c) Pass to each `<LaneRow>`:

```tsx
								onItemLinkCommit={handleItemLinkCommit}
```

- [ ] **Step 4: Wire mutations in the editor route**

In `src/routes/roadmaps/$id.tsx`:

(a) Add the mutations next to the existing ones:

```tsx
	const createDependency = useMutation(api.dependencies.create);
	const removeDependency = useMutation(api.dependencies.remove);
```

(b) Pass them to `<TimelineView>`:

```tsx
						onCreateDependency={(predecessorId, successorId) =>
							createDependency({ roadmapId, predecessorId, successorId }).catch(
								() => {},
							)
						}
						onRemoveDependency={(id) =>
							removeDependency({ dependencyId: id })
						}
```

- [ ] **Step 5: Typecheck, lint, test, build**

Run: `npx tsc --noEmit && npm run check && npm run test && npm run build`
Expected: all pass.

- [ ] **Step 6: Manual verification**

With both processes running: hover a bar → a small circle handle appears at its right edge. Drag from it onto another bar → an arrow is created. Hover an existing arrow → an × appears at its elbow; click it → the arrow is removed. Open the public share link (Share dialog → enable) in a private window → arrows render but no handles or × appear, and bars are not draggable.

- [ ] **Step 7: Commit**

```bash
git add src/components/timeline/ItemBar.tsx src/components/timeline/LaneRow.tsx src/components/timeline/TimelineView.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat(deps): drag-to-link bars and click-to-delete arrows"
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint/format**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `npm run test`
Expected: all pass, including `src/lib/__tests__/dependencies.test.ts`, `convex/dependencies.test.ts`, `src/lib/__tests__/roadmapIO.test.ts`, `convex/roadmapVersions.test.ts`, `src/components/timeline/__tests__/DependencyLayer.test.tsx`.

- [ ] **Step 4: Backend deploy typecheck**

Run: `npx convex dev --once`
Expected: completes without error.

- [ ] **Step 5: Production build smoke test**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Confirm no stray changes / final state**

Run: `git status`
Expected: clean tree (everything committed).

---

## Self-review notes

- **Spec coverage:** table + indexes (T1), bundle/share propagation (T2), cycle logic (T3), arrow geometry (T4), create with self/dup/cycle/cross-roadmap guards (T5), remove (T6), cascade-delete (T7), snapshot round-trip (T8), duplicate (T9), export/import by index (T10), arrow rendering (T11), panel picker (T12), drag-to-link + arrow delete + read-only gating (T13). Public share renders arrows for free via T2 (`getPublicRoadmap` → `loadRoadmapChildren`) and `ReadOnlyRoadmap` passes no edit callbacks, so `editable` is false — no extra task needed; verified in T13 Step 6.
- **Types:** `Edge` / `ItemRect` / `DependencyArrow` defined in `src/lib/dependencies.ts` (T3–T4) and reused in `DependencyLayer` (T11). Server-side `canReach` is a deliberate `Doc`-typed twin of the client helper (per spec). Prop names (`onCreateDependency`, `onRemoveDependency`, `onLinkDrag`, `onLinkCommit`, `onItemLinkCommit`, `allItems`, `dependencies`) are consistent across T11–T13.
- **Backward compatibility:** snapshot and export `dependencies` are optional; existing stored snapshots and older JSON exports load unchanged (covered by T8 and T10 Step 1's second test).

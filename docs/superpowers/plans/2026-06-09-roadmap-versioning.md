# Roadmap Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save named checkpoints of a roadmap and restore any of them, with an automatic safety checkpoint taken before every destructive action (JSON import and restore).

**Architecture:** A new `roadmapVersions` table stores a full snapshot of a roadmap (the same payload shape the JSON import already uses). Snapshot/restore logic is extracted into shared `convex/lib/snapshot.ts` helpers reused by both the JSON-import path and new `convex/roadmapVersions.ts` functions. A `VersionManager` dialog (same pattern as `LaneManager`) drives create/restore from the editor toolbar.

**Tech Stack:** Convex (schema, queries, mutations, `convex-test`), React 19 + `radix-ui` Dialog, Lucide icons, date-fns, Biome (tabs, double quotes), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-roadmap-versioning-design.md`

---

## File Structure

- **Create** `convex/lib/snapshot.ts` — `snapshotRoadmap`, `applySnapshot`, `saveVersion`, `MAX_VERSIONS`. Single home for all snapshot/restore/prune logic.
- **Create** `convex/roadmapVersions.ts` — `list` (query), `create`/`restore` (mutations).
- **Create** `convex/roadmapVersions.test.ts` — `convex-test` coverage.
- **Create** `src/components/versions/VersionManager.tsx` — the dialog UI.
- **Modify** `convex/schema.ts` — add `roadmapVersions` table + `roadmapSnapshotValidator` (moved from `io.ts`).
- **Modify** `convex/io.ts` — import the moved validator; auto-checkpoint then delegate to `applySnapshot`.
- **Modify** `src/routes/roadmaps/$id.tsx` — "Versions" toolbar button + dialog wiring.

> **Convention reminders (from CLAUDE.md):** Biome uses **tabs** and **double quotes** — run `npm run check` (autofix `npx biome check --write src/`) before every commit. After editing anything in `convex/`, run `npx convex dev --once` to regenerate `convex/_generated` and typecheck the backend; commit the regenerated output with the change. Convex schema validators use the `v` builder; never declare `_id`/`_creationTime` (they are automatic).

---

## Task 1: Add `roadmapVersions` table and move the snapshot validator into the schema

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/io.ts:13-56` (remove the inline `importPayloadValidator`, import the moved one)

- [ ] **Step 1: Add `roadmapSnapshotValidator` and the `roadmapVersions` table to the schema**

In `convex/schema.ts`, add the validator just above `export default defineSchema({` (it reuses validators already declared in this file):

```typescript
export const roadmapSnapshotValidator = v.object({
	name: v.string(),
	startDate: v.number(),
	endDate: v.number(),
	defaultZoom: zoomValidator,
	colorByFieldKey: v.optional(v.string()),
	fields: v.array(
		v.object({
			key: v.string(),
			label: v.string(),
			type: fieldTypeValidator,
			options: v.optional(v.array(fieldOptionValidator)),
			order: v.number(),
			showInTable: v.boolean(),
			isSystem: v.optional(v.boolean()),
		}),
	),
	lanes: v.array(
		v.object({
			name: v.string(),
			color: v.optional(v.string()),
			order: v.number(),
			isDefault: v.optional(v.boolean()),
		}),
	),
	items: v.array(
		v.object({
			title: v.string(),
			laneIndex: v.number(),
			startDate: v.number(),
			endDate: v.number(),
			description: v.optional(v.string()),
			values: v.record(v.string(), fieldValueValidator),
			order: v.number(),
		}),
	),
	milestones: v.array(
		v.object({
			name: v.string(),
			date: v.number(),
			color: v.optional(v.string()),
		}),
	),
});
```

Then add this table inside the `defineSchema({ ... })` object, after `milestones`:

```typescript
	roadmapVersions: defineTable({
		roadmapId: v.id("roadmaps"),
		userId: v.string(),
		label: v.string(),
		kind: v.union(v.literal("manual"), v.literal("auto")),
		snapshot: roadmapSnapshotValidator,
	}).index("by_roadmap", ["roadmapId"]),
```

- [ ] **Step 2: Replace the inline validator in `io.ts` with the moved one**

In `convex/io.ts`, delete the entire `const importPayloadValidator = v.object({ ... });` block (lines 13-56) and update the imports. The import of validators from `./schema` changes from:

```typescript
import {
	fieldOptionValidator,
	fieldTypeValidator,
	fieldValueValidator,
	zoomValidator,
} from "./schema";
```

to:

```typescript
import { roadmapSnapshotValidator } from "./schema";
```

Then change the mutation args to use it:

```typescript
export const replaceRoadmap = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		payload: roadmapSnapshotValidator,
	},
```

Leave the rest of the `replaceRoadmap` handler unchanged for now (Task 4 refactors it). The `v` import stays (still used for `v.id`).

- [ ] **Step 3: Regenerate Convex and typecheck**

Run: `npx convex dev --once`
Expected: completes without type errors; `convex/_generated/` updates (now includes the `roadmapVersions` table type).

- [ ] **Step 4: Run existing backend tests to confirm no regression**

Run: `npx vitest run convex/`
Expected: PASS — `io`/`roadmaps`/`items`/`lanes`/`sharing` tests still green (the validator move is behavior-neutral; the client already sends the `version`-stripped payload that matches this shape).

- [ ] **Step 5: Lint + commit**

Run: `npm run check`
Expected: no errors.

```bash
git add convex/schema.ts convex/io.ts convex/_generated
git commit -m "feat: add roadmapVersions table and shared roadmap snapshot validator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Create shared snapshot/restore/save helpers

**Files:**
- Create: `convex/lib/snapshot.ts`

- [ ] **Step 1: Create `convex/lib/snapshot.ts`**

This module owns all snapshot logic. `applySnapshot` is the delete-children + patch-roadmap + re-insert routine **moved verbatim** from the current `io.replaceRoadmap` handler (`convex/io.ts:63-123`), including the lane-index remap and the "default lane when the snapshot has none" fallback. `snapshotRoadmap` is the server-side mirror of `src/lib/roadmapIO.ts#serializeRoadmap`.

```typescript
import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { loadRoadmapChildren } from "./bundle";
import { roadmapSnapshotValidator } from "../schema";

export const MAX_VERSIONS = 25;

export type RoadmapSnapshot = Infer<typeof roadmapSnapshotValidator>;

/** Builds a full snapshot payload from the roadmap's current state. */
export async function snapshotRoadmap(
	ctx: MutationCtx,
	roadmapId: Id<"roadmaps">,
): Promise<RoadmapSnapshot> {
	const roadmap = await ctx.db.get(roadmapId);
	if (!roadmap) throw new Error("Roadmap not found");
	const { fields, lanes, items, milestones } = await loadRoadmapChildren(
		ctx,
		roadmapId,
	);
	const laneIndex = new Map<Id<"lanes">, number>();
	lanes.forEach((lane, i) => laneIndex.set(lane._id, i));
	return {
		name: roadmap.name,
		startDate: roadmap.startDate,
		endDate: roadmap.endDate,
		defaultZoom: roadmap.defaultZoom,
		colorByFieldKey: roadmap.colorByFieldKey,
		fields: fields.map((f) => ({
			key: f.key,
			label: f.label,
			type: f.type,
			options: f.options,
			order: f.order,
			showInTable: f.showInTable,
			isSystem: f.isSystem,
		})),
		lanes: lanes.map((l) => ({
			name: l.name,
			color: l.color,
			order: l.order,
			isDefault: l.isDefault,
		})),
		items: items.map((it) => ({
			title: it.title,
			laneIndex: laneIndex.get(it.laneId) ?? 0,
			startDate: it.startDate,
			endDate: it.endDate,
			description: it.description,
			values: it.values,
			order: it.order,
		})),
		milestones: milestones.map((m) => ({
			name: m.name,
			date: m.date,
			color: m.color,
		})),
	};
}

/** Replaces a roadmap's children with the snapshot's contents. */
export async function applySnapshot(
	ctx: MutationCtx,
	roadmapId: Id<"roadmaps">,
	userId: string,
	snapshot: RoadmapSnapshot,
): Promise<void> {
	const existing = await loadRoadmapChildren(ctx, roadmapId);
	for (const row of [
		...existing.fields,
		...existing.lanes,
		...existing.items,
		...existing.milestones,
	]) {
		await ctx.db.delete(row._id);
	}

	await ctx.db.patch(roadmapId, {
		name: snapshot.name,
		startDate: snapshot.startDate,
		endDate: snapshot.endDate,
		defaultZoom: snapshot.defaultZoom,
		colorByFieldKey: snapshot.colorByFieldKey,
	});

	for (const f of snapshot.fields) {
		await ctx.db.insert("fields", { roadmapId, userId, ...f });
	}

	const lanes = snapshot.lanes.length
		? snapshot.lanes
		: [{ name: "General", order: 0, isDefault: true }];
	const laneIds: Id<"lanes">[] = [];
	for (let i = 0; i < lanes.length; i++) {
		const lane = lanes[i];
		const id = await ctx.db.insert("lanes", {
			roadmapId,
			userId,
			name: lane.name,
			color: lane.color,
			order: lane.order,
			isDefault: lane.isDefault ?? i === 0,
		});
		laneIds.push(id);
	}

	for (const it of snapshot.items) {
		const laneId = laneIds[it.laneIndex] ?? laneIds[0];
		await ctx.db.insert("items", {
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
	}

	for (const m of snapshot.milestones) {
		await ctx.db.insert("milestones", { roadmapId, userId, ...m });
	}
}

/** Snapshots current state into a roadmapVersions row, then prunes to MAX_VERSIONS (oldest first). */
export async function saveVersion(
	ctx: MutationCtx,
	roadmapId: Id<"roadmaps">,
	userId: string,
	label: string,
	kind: "manual" | "auto",
): Promise<void> {
	const snapshot = await snapshotRoadmap(ctx, roadmapId);
	await ctx.db.insert("roadmapVersions", { roadmapId, userId, label, kind, snapshot });

	const all = await ctx.db
		.query("roadmapVersions")
		.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
		.collect();
	if (all.length > MAX_VERSIONS) {
		const oldest = [...all]
			.sort((a, b) => a._creationTime - b._creationTime)
			.slice(0, all.length - MAX_VERSIONS);
		for (const row of oldest) {
			await ctx.db.delete(row._id);
		}
	}
}
```

- [ ] **Step 2: Regenerate Convex and typecheck**

Run: `npx convex dev --once`
Expected: no type errors. (Helpers aren't wired to any function yet; this just confirms they compile. They are exercised by tests in Task 3.)

- [ ] **Step 3: Lint + commit**

Run: `npm run check`
Expected: no errors.

```bash
git add convex/lib/snapshot.ts
git commit -m "feat: shared snapshot/restore/saveVersion helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Versions backend functions (list / create / restore) — TDD

**Files:**
- Create: `convex/roadmapVersions.test.ts`
- Create: `convex/roadmapVersions.ts`

- [ ] **Step 1: Write the failing tests**

Create `convex/roadmapVersions.test.ts`. These tests build a roadmap, add an item, snapshot it, mutate, then restore and assert the original is reproduced; they also cover the auto-checkpoint, the cap, and ownership.

```typescript
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupRoadmap(t: ReturnType<typeof convexTest>) {
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 100 });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	return { roadmapId, laneId: bundle.lanes[0]._id };
}

test("create saves a manual version of the current state", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, laneId } = await setupRoadmap(t);
	await t.withIdentity({ subject: "user_alex" }).mutation(api.items.create, {
		roadmapId,
		laneId,
		title: "Original",
		startDate: 0,
		endDate: 10,
		values: {},
	});

	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.create, { roadmapId, label: "Checkpoint" });

	const list = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	expect(list).toHaveLength(1);
	expect(list[0].label).toBe("Checkpoint");
	expect(list[0].kind).toBe("manual");
});

test("restore reproduces the snapshot and auto-checkpoints first", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId, laneId } = await setupRoadmap(t);
	await t.withIdentity({ subject: "user_alex" }).mutation(api.items.create, {
		roadmapId,
		laneId,
		title: "Original",
		startDate: 0,
		endDate: 10,
		values: {},
	});

	// Checkpoint, then delete the item so current state differs.
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.create, { roadmapId, label: "Has item" });
	const before = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.items.remove, { itemId: before.items[0]._id });

	const list = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	const checkpoint = list.find((v) => v.label === "Has item");
	if (!checkpoint) throw new Error("checkpoint missing");
	await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmapVersions.restore, { versionId: checkpoint._id });

	const after = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(after.items.map((i) => i.title)).toEqual(["Original"]);

	const list2 = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	expect(list2.some((v) => v.kind === "auto" && v.label === "Before restore")).toBe(true);
});

test("versions are capped at MAX_VERSIONS, pruning oldest first", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId } = await setupRoadmap(t);
	for (let i = 0; i < 27; i++) {
		await t
			.withIdentity({ subject: "user_alex" })
			.mutation(api.roadmapVersions.create, { roadmapId, label: `v${i}` });
	}
	const list = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	expect(list).toHaveLength(25);
	// list is newest-first; the two oldest (v0, v1) were pruned.
	expect(list.some((v) => v.label === "v0")).toBe(false);
	expect(list.some((v) => v.label === "v26")).toBe(true);
});

test("a non-owner cannot create or restore versions", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId } = await setupRoadmap(t);
	await expect(
		t
			.withIdentity({ subject: "user_mallory" })
			.mutation(api.roadmapVersions.create, { roadmapId, label: "x" }),
	).rejects.toThrow(/access denied/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run convex/roadmapVersions.test.ts`
Expected: FAIL — `api.roadmapVersions` does not exist (cannot read `create`/`list`/`restore`).

- [ ] **Step 3: Implement `convex/roadmapVersions.ts`**

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { applySnapshot, saveVersion } from "./lib/snapshot";

export const list = query({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, { roadmapId }) => {
		await requireRoadmapOwner(ctx, roadmapId);
		const versions = await ctx.db
			.query("roadmapVersions")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect();
		return versions
			.sort((a, b) => b._creationTime - a._creationTime)
			.map((row) => ({
				_id: row._id,
				label: row.label,
				kind: row.kind,
				_creationTime: row._creationTime,
			}));
	},
});

export const create = mutation({
	args: { roadmapId: v.id("roadmaps"), label: v.string() },
	handler: async (ctx, { roadmapId, label }) => {
		const { userId } = await requireRoadmapOwner(ctx, roadmapId);
		const existing = await ctx.db
			.query("roadmapVersions")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect();
		const finalLabel = label.trim() || `Version ${existing.length + 1}`;
		await saveVersion(ctx, roadmapId, userId, finalLabel, "manual");
	},
});

export const restore = mutation({
	args: { versionId: v.id("roadmapVersions") },
	handler: async (ctx, { versionId }) => {
		const version = await ctx.db.get(versionId);
		if (!version) throw new Error("Version not found");
		const { userId } = await requireRoadmapOwner(ctx, version.roadmapId);
		await saveVersion(ctx, version.roadmapId, userId, "Before restore", "auto");
		await applySnapshot(ctx, version.roadmapId, userId, version.snapshot);
	},
});
```

- [ ] **Step 4: Regenerate Convex, then run the tests**

Run: `npx convex dev --once && npx vitest run convex/roadmapVersions.test.ts`
Expected: PASS — all four tests green.

- [ ] **Step 5: Lint + commit**

Run: `npm run check`
Expected: no errors.

```bash
git add convex/roadmapVersions.ts convex/roadmapVersions.test.ts convex/_generated
git commit -m "feat: versions list/create/restore mutations with cap and auto-checkpoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Route the JSON import through the shared path with an auto-checkpoint — TDD

**Files:**
- Modify: `convex/io.ts` (the `replaceRoadmap` handler body)
- Test: `convex/io.test.ts` (create if absent; otherwise append)

- [ ] **Step 1: Write the failing test**

Create (or append to) `convex/io.test.ts`. It asserts that a JSON import leaves a "Before JSON import" auto-version behind and applies the new data.

```typescript
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("replaceRoadmap auto-checkpoints the prior state before importing", async () => {
	const t = convexTest(schema, modules);
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "Before", startDate: 0, endDate: 100 });

	await t.withIdentity({ subject: "user_alex" }).mutation(api.io.replaceRoadmap, {
		roadmapId,
		payload: {
			name: "After",
			startDate: 0,
			endDate: 100,
			defaultZoom: "month",
			fields: [],
			lanes: [{ name: "Lane A", order: 0, isDefault: true }],
			items: [],
			milestones: [],
		},
	});

	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.roadmap.name).toBe("After");

	const list = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmapVersions.list, { roadmapId });
	expect(list.some((v) => v.kind === "auto" && v.label === "Before JSON import")).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run convex/io.test.ts`
Expected: FAIL — no version is created (the current `replaceRoadmap` does not call `saveVersion`), so the `expect(...).toBe(true)` assertion fails.

- [ ] **Step 3: Refactor `replaceRoadmap` to checkpoint + delegate**

In `convex/io.ts`, replace the entire `replaceRoadmap` handler body with a call to the shared helpers. Update the imports at the top of the file to:

```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { applySnapshot, saveVersion } from "./lib/snapshot";
import { roadmapSnapshotValidator } from "./schema";
```

(Remove the now-unused `Id`, `loadRoadmapChildren` imports.) The mutation becomes:

```typescript
export const replaceRoadmap = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		payload: roadmapSnapshotValidator,
	},
	handler: async (ctx, { roadmapId, payload }) => {
		const { userId } = await requireRoadmapOwner(ctx, roadmapId);
		await saveVersion(ctx, roadmapId, userId, "Before JSON import", "auto");
		await applySnapshot(ctx, roadmapId, userId, payload);
	},
});
```

- [ ] **Step 4: Regenerate Convex, then run the io tests**

Run: `npx convex dev --once && npx vitest run convex/io.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite to confirm no regression**

Run: `npx vitest run convex/`
Expected: PASS across all convex tests.

- [ ] **Step 6: Lint + commit**

Run: `npm run check`
Expected: no errors.

```bash
git add convex/io.ts convex/io.test.ts convex/_generated
git commit -m "feat: auto-checkpoint before JSON import via shared snapshot path

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: VersionManager dialog component

**Files:**
- Create: `src/components/versions/VersionManager.tsx`

> No unit test: this codebase does not unit-test its dialog components (`LaneManager`, `FieldManager`, `ImportExportDialog` have none). Verified by `npx tsc --noEmit` and the manual checks in Task 6. Follow the `LaneManager` structure (`radix-ui` Dialog, `rm-btn-primary`, tab indentation, double quotes).

- [ ] **Step 1: Create the component**

```tsx
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { History, Plus } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";

export function VersionManager({
	roadmapId,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const versions = useQuery(
		api.roadmapVersions.list,
		open ? { roadmapId } : "skip",
	);
	const createVersion = useMutation(api.roadmapVersions.create);
	const restoreVersion = useMutation(api.roadmapVersions.restore);
	const [label, setLabel] = useState("");
	const [confirmId, setConfirmId] = useState<Id<"roadmapVersions"> | null>(null);

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">Versions</Dialog.Title>
					<Dialog.Description className="mt-1 text-xs text-neutral-500">
						Save a checkpoint of the current roadmap, or restore an earlier one.
						A safety checkpoint is saved automatically before any restore.
					</Dialog.Description>

					<div className="mt-4 flex gap-2">
						<input
							className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
							placeholder="Version name (optional)"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
						<button
							type="button"
							onClick={async () => {
								await createVersion({ roadmapId, label: label.trim() });
								setLabel("");
							}}
							className="flex items-center gap-1 rm-btn-primary"
						>
							<Plus size={14} /> Save
						</button>
					</div>

					<div className="mt-4 max-h-72 space-y-2 overflow-auto">
						{versions === undefined ? (
							<p className="text-sm text-neutral-500">Loading…</p>
						) : versions.length === 0 ? (
							<p className="text-sm text-neutral-500">
								No versions yet. Save one to create a restore point.
							</p>
						) : (
							versions.map((version) => (
								<div
									key={version._id}
									className="flex items-center gap-2 rounded-md border border-neutral-200 p-2"
								>
									<History size={15} className="shrink-0 text-neutral-400" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate text-sm font-medium">
												{version.label}
											</span>
											<span
												className={
													version.kind === "manual"
														? "rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-white"
														: "rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500"
												}
											>
												{version.kind === "manual" ? "Manual" : "Auto"}
											</span>
										</div>
										<span className="block text-[11px] text-neutral-500">
											{formatDistanceToNow(version._creationTime, {
												addSuffix: true,
											})}
										</span>
									</div>
									{confirmId === version._id ? (
										<div className="flex shrink-0 items-center gap-1">
											<button
												type="button"
												onClick={async () => {
													await restoreVersion({ versionId: version._id });
													setConfirmId(null);
													onOpenChange(false);
												}}
												className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setConfirmId(null)}
												className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
											>
												Cancel
											</button>
										</div>
									) : (
										<button
											type="button"
											onClick={() => setConfirmId(version._id)}
											className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-100"
										>
											Restore
										</button>
									)}
								</div>
							))
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/versions/VersionManager.tsx
git commit -m "feat: VersionManager dialog for saving and restoring versions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Wire the "Versions" button into the editor toolbar

**Files:**
- Modify: `src/routes/roadmaps/$id.tsx`

- [ ] **Step 1: Import the component**

Add this import alongside the other component imports near the top of `src/routes/roadmaps/$id.tsx` (keep imports alphabetized to satisfy Biome — place it after the `RoadmapSettingsDialog`/`ShareDialog` imports, before `ItemTable`):

```tsx
import { VersionManager } from "@/components/versions/VersionManager";
```

- [ ] **Step 2: Add dialog open state**

Next to the other `useState` dialog flags (after `const [ioOpen, setIoOpen] = useState(false);`):

```tsx
	const [versionsOpen, setVersionsOpen] = useState(false);
```

- [ ] **Step 3: Add the toolbar button**

In the toolbar `<div className="flex flex-wrap items-center gap-2">`, add a button immediately after the "Edit JSON data" button (the one with `onClick={() => setIoOpen(true)}`):

```tsx
							<button
								type="button"
								className={toolbarBtn}
								onClick={() => setVersionsOpen(true)}
							>
								Versions
							</button>
```

- [ ] **Step 4: Render the dialog**

Next to the other manager dialogs at the bottom of the component (after `<ImportExportDialog ... />`):

```tsx
				<VersionManager
					roadmapId={roadmapId}
					open={versionsOpen}
					onOpenChange={setVersionsOpen}
				/>
```

- [ ] **Step 5: Typecheck + lint + build smoke test**

Run: `npx tsc --noEmit && npm run check && npm run build`
Expected: all succeed (build is the best compile smoke test).

- [ ] **Step 6: Manual end-to-end verification**

Start both processes (two terminals): `npx convex dev` and `npm run dev` (app on :3000). Then:
1. Open a roadmap, click **Versions** → dialog shows "No versions yet."
2. Type "Checkpoint A", click **Save** → it appears with a **Manual** badge and a relative time.
3. Move/edit an item, then **Versions → Restore** on "Checkpoint A" → confirm → the item returns to its checkpointed position; a new **Auto** "Before restore" entry now appears in the list.
4. Open **Edit JSON data**, change the roadmap `name`, Save → Overwrite → reopen **Versions** → an **Auto** "Before JSON import" entry is present; restoring it brings the old name back.
5. Confirm the list never exceeds 25 entries after repeated saves.

- [ ] **Step 7: Commit**

```bash
git add src/routes/roadmaps/$id.tsx
git commit -m "feat: add Versions button to roadmap editor toolbar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** manual checkpoints (Task 3 `create`), restore (Task 3 `restore`), auto-checkpoint before restore (Task 3) and before JSON import (Task 4), cap-25 oldest-first (Task 2 `saveVersion` + Task 3 cap test), validator move / shared helpers / `getBundle` untouched (Tasks 1-2), toolbar button + dialog with kind badges and relative time (Tasks 5-6), no manual delete / no diff view (omitted per YAGNI). All covered.
- **Type consistency:** `RoadmapSnapshot` / `roadmapSnapshotValidator` / `MAX_VERSIONS` / `snapshotRoadmap` / `applySnapshot` / `saveVersion` are named identically across Tasks 2-4. `api.roadmapVersions.list/create/restore` and `api.io.replaceRoadmap` signatures match their call sites in tests and UI.
- **Placeholder scan:** no TBD/TODO; every code step contains full code; every command has an expected result.

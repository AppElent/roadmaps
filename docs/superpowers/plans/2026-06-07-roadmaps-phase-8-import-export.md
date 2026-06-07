# Roadmaps Phase 8 — Import / Export JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export a roadmap to JSON and import JSON as a brand-new roadmap, preserving fields, lanes, items, and milestones.

**Architecture:** `src/lib/roadmapIO.ts` (tested) serializes a bundle to a versioned, id-free export (items reference lanes by index) and parses/validates an import with Zod. `io.importRoadmap` recreates the roadmap under the caller, remapping lane indices to new ids. `ImportExportDialog` drives both flows.

**Tech Stack:** Zod, Convex `useMutation`, TanStack Router.

**Depends on:** Phases 0–7.

---

## File structure for this phase

- Create: `src/lib/roadmapIO.ts` — `serializeRoadmap`, `parseImport`, types
- Create: `src/lib/__tests__/roadmapIO.test.ts`
- Create: `convex/io.ts` — `importRoadmap` mutation
- Create: `src/components/io/ImportExportDialog.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` — "Import/Export" button

---

### Task 1: Serialize & parse (TDD)

**Files:**
- Create: `src/lib/roadmapIO.ts`
- Create: `src/lib/__tests__/roadmapIO.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/roadmapIO.test.ts`:

```ts
import { expect, test } from "vitest";
import type { Doc } from "@convex/_generated/dataModel";
import { parseImport, serializeRoadmap } from "../roadmapIO";

const bundle = {
	roadmap: {
		_id: "r1",
		_creationTime: 0,
		userId: "u",
		name: "R",
		startDate: 0,
		endDate: 1000,
		defaultZoom: "month",
		colorByFieldKey: "status",
		visibility: "private",
		archived: false,
	} as unknown as Doc<"roadmaps">,
	fields: [
		{
			_id: "f1",
			_creationTime: 0,
			roadmapId: "r1",
			userId: "u",
			key: "status",
			label: "Status",
			type: "select",
			options: [{ id: "planned", label: "Planned", color: "#000" }],
			order: 0,
			showInTable: true,
			isSystem: true,
		},
	] as unknown as Doc<"fields">[],
	lanes: [
		{ _id: "lane_a", _creationTime: 0, roadmapId: "r1", userId: "u", name: "A", order: 0, isDefault: true },
		{ _id: "lane_b", _creationTime: 0, roadmapId: "r1", userId: "u", name: "B", order: 1 },
	] as unknown as Doc<"lanes">[],
	items: [
		{
			_id: "i1",
			_creationTime: 0,
			roadmapId: "r1",
			laneId: "lane_b",
			userId: "u",
			title: "Item",
			startDate: 10,
			endDate: 20,
			values: { status: "planned" },
			order: 0,
		},
	] as unknown as Doc<"items">[],
	milestones: [] as unknown as Doc<"milestones">[],
};

test("serializeRoadmap references lanes by index", () => {
	const out = serializeRoadmap(bundle);
	expect(out.version).toBe(1);
	expect(out.items[0].laneIndex).toBe(1); // lane_b is index 1
	expect(out.lanes.map((l) => l.name)).toEqual(["A", "B"]);
});

test("parseImport accepts serialized output and rejects junk", () => {
	const json = JSON.stringify(serializeRoadmap(bundle));
	const parsed = parseImport(json);
	expect(parsed.name).toBe("R");
	expect(() => parseImport('{"nope":true}')).toThrow();
	expect(() => parseImport("not json")).toThrow();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/roadmapIO.test.ts`
Expected: FAIL — cannot find `../roadmapIO`.

- [ ] **Step 3: Implement `src/lib/roadmapIO.ts`**

```ts
import { z } from "zod";
import type { Doc } from "@convex/_generated/dataModel";
import type { TimelineBundle } from "@/components/timeline/TimelineView";

const optionSchema = z.object({
	id: z.string(),
	label: z.string(),
	color: z.string(),
});

const valueSchema = z.union([
	z.string(),
	z.number(),
	z.array(z.string()),
	z.null(),
]);

export const roadmapExportSchema = z.object({
	version: z.literal(1),
	name: z.string(),
	startDate: z.number(),
	endDate: z.number(),
	defaultZoom: z.enum(["week", "month", "quarter", "half"]),
	colorByFieldKey: z.string().optional(),
	fields: z.array(
		z.object({
			key: z.string(),
			label: z.string(),
			type: z.enum(["text", "number", "date", "select", "multiselect"]),
			options: z.array(optionSchema).optional(),
			order: z.number(),
			showInTable: z.boolean(),
			isSystem: z.boolean().optional(),
		}),
	),
	lanes: z.array(
		z.object({
			name: z.string(),
			color: z.string().optional(),
			order: z.number(),
			isDefault: z.boolean().optional(),
		}),
	),
	items: z.array(
		z.object({
			title: z.string(),
			laneIndex: z.number(),
			startDate: z.number(),
			endDate: z.number(),
			description: z.string().optional(),
			values: z.record(z.string(), valueSchema),
			order: z.number(),
		}),
	),
	milestones: z.array(
		z.object({
			name: z.string(),
			date: z.number(),
			color: z.string().optional(),
		}),
	),
});

export type RoadmapExport = z.infer<typeof roadmapExportSchema>;

export function serializeRoadmap(bundle: TimelineBundle): RoadmapExport {
	const laneIndex = new Map<Doc<"lanes">["_id"], number>();
	bundle.lanes.forEach((lane, i) => laneIndex.set(lane._id, i));
	return {
		version: 1,
		name: bundle.roadmap.name,
		startDate: bundle.roadmap.startDate,
		endDate: bundle.roadmap.endDate,
		defaultZoom: bundle.roadmap.defaultZoom,
		colorByFieldKey: bundle.roadmap.colorByFieldKey,
		fields: bundle.fields.map((f) => ({
			key: f.key,
			label: f.label,
			type: f.type,
			options: f.options,
			order: f.order,
			showInTable: f.showInTable,
			isSystem: f.isSystem,
		})),
		lanes: bundle.lanes.map((l) => ({
			name: l.name,
			color: l.color,
			order: l.order,
			isDefault: l.isDefault,
		})),
		items: bundle.items.map((it) => ({
			title: it.title,
			laneIndex: laneIndex.get(it.laneId) ?? 0,
			startDate: it.startDate,
			endDate: it.endDate,
			description: it.description,
			values: it.values,
			order: it.order,
		})),
		milestones: bundle.milestones.map((m) => ({
			name: m.name,
			date: m.date,
			color: m.color,
		})),
	};
}

export function parseImport(text: string): RoadmapExport {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error("Invalid JSON");
	}
	return roadmapExportSchema.parse(raw);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/roadmapIO.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roadmapIO.ts src/lib/__tests__/roadmapIO.test.ts
git commit -m "feat: roadmap serialize and import parsing"
```

---

### Task 2: importRoadmap mutation

**Files:**
- Create: `convex/io.ts`

- [ ] **Step 1: Implement `convex/io.ts`**

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import {
	fieldOptionValidator,
	fieldTypeValidator,
	fieldValueValidator,
	zoomValidator,
} from "./schema";

export const importRoadmap = mutation({
	args: {
		payload: v.object({
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
		}),
	},
	handler: async (ctx, { payload }) => {
		const userId = await requireUser(ctx);
		const roadmapId = await ctx.db.insert("roadmaps", {
			userId,
			name: payload.name,
			startDate: payload.startDate,
			endDate: payload.endDate,
			defaultZoom: payload.defaultZoom,
			colorByFieldKey: payload.colorByFieldKey,
			visibility: "private",
			archived: false,
		});

		for (const f of payload.fields) {
			await ctx.db.insert("fields", { roadmapId, userId, ...f });
		}

		// Ensure at least one lane; mark the first as default if none is.
		const lanes = payload.lanes.length
			? payload.lanes
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

		for (const it of payload.items) {
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

		for (const m of payload.milestones) {
			await ctx.db.insert("milestones", { roadmapId, userId, ...m });
		}

		return roadmapId;
	},
});
```

- [ ] **Step 2: Regenerate + typecheck**

Run: `npx convex dev --once`
Expected: `api.io.importRoadmap` generated, no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/io.ts
git commit -m "feat: importRoadmap mutation"
```

---

### Task 3: ImportExportDialog

**Files:**
- Create: `src/components/io/ImportExportDialog.tsx`
- Modify: `src/routes/roadmaps/$id.tsx`

- [ ] **Step 1: Implement the dialog**

```tsx
import { useState } from "react";
import { Dialog } from "radix-ui";
import { useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@convex/_generated/api";
import type { TimelineBundle } from "@/components/timeline/TimelineView";
import { parseImport, serializeRoadmap } from "@/lib/roadmapIO";

export function ImportExportDialog({
	bundle,
	open,
	onOpenChange,
}: {
	bundle: TimelineBundle;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const navigate = useNavigate();
	const importRoadmap = useMutation(api.io.importRoadmap);
	const [tab, setTab] = useState<"export" | "import">("export");
	const [importText, setImportText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const exportText = JSON.stringify(serializeRoadmap(bundle), null, 2);

	async function runImport() {
		setError(null);
		try {
			const parsed = parseImport(importText);
			const { version: _v, ...payload } = parsed;
			const id = await importRoadmap({ payload });
			onOpenChange(false);
			await navigate({ to: "/roadmaps/$id", params: { id } });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Import failed");
		}
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">Import / Export</Dialog.Title>
					<div className="mt-3 inline-flex overflow-hidden rounded-md border border-neutral-200">
						{(["export", "import"] as const).map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setTab(t)}
								className={`border-r border-neutral-200 px-3 py-1.5 text-xs capitalize last:border-r-0 ${
									t === tab ? "bg-neutral-100" : "text-neutral-500"
								}`}
							>
								{t}
							</button>
						))}
					</div>

					{tab === "export" ? (
						<div className="mt-3 space-y-2">
							<textarea
								readOnly
								value={exportText}
								className="h-64 w-full rounded-md border border-neutral-200 p-2 font-mono text-xs"
							/>
							<button
								type="button"
								onClick={() => navigator.clipboard.writeText(exportText)}
								className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm"
							>
								Copy JSON
							</button>
						</div>
					) : (
						<div className="mt-3 space-y-2">
							<textarea
								value={importText}
								onChange={(e) => setImportText(e.target.value)}
								placeholder="Paste exported roadmap JSON"
								className="h-64 w-full rounded-md border border-neutral-200 p-2 font-mono text-xs"
							/>
							{error ? <p className="text-xs text-red-600">{error}</p> : null}
							<button
								type="button"
								onClick={runImport}
								className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
							>
								Import as new roadmap
							</button>
						</div>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 2: Wire the button in the editor**

In `src/routes/roadmaps/$id.tsx`, add `const [ioOpen, setIoOpen] = useState(false);`, an "Import/Export" header button, and render:

```tsx
<ImportExportDialog bundle={bundle} open={ioOpen} onOpenChange={setIoOpen} />
```

with `import { ImportExportDialog } from "@/components/io/ImportExportDialog";`.

- [ ] **Step 3: Verify manually**

Run: `npm run dev:all`. Export a roadmap, copy the JSON. Open Import, paste it, click Import → a new roadmap is created and opens with the same lanes/items/fields/milestones.

- [ ] **Step 4: Lint + commit**

```bash
npm run check
git add src/components/io/ImportExportDialog.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat: import/export dialog"
```

---

## Self-review notes

- **Spec coverage:** export to JSON + import creating a new roadmap (§1, §4) ✓; lane references survive via index remap ✓; import validated client-side (Zod) and server-side (Convex validators) ✓.
- **Type consistency:** `serializeRoadmap` consumes `TimelineBundle`; `parseImport` returns `RoadmapExport`; the mutation `payload` validator mirrors the export schema minus `version`. `importRoadmap` enforces at-least-one-lane and clamps bad `laneIndex` to lane 0.
- **Security:** `importRoadmap` calls `requireUser` and always creates under the caller; no cross-user references are possible since all ids are freshly minted.

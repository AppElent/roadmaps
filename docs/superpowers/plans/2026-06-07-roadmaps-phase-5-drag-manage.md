# Roadmaps Phase 5 — Drag/Resize & Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Direct manipulation of item bars (drag to reschedule, drag edges to resize, arrow-key nudge) and UIs for managing lanes and custom fields.

**Architecture:** A tested pure `resolveDrag` converts a pixel delta + mode into snapped dates. `ItemBar` tracks pointer gestures locally (optimistic visual offset) and commits on pointer-up; `TimelineView` runs `resolveDrag` and calls an optional `onItemDatesChange`, so the same component stays read-only for the share view. `LaneManager` and `FieldManager` are dialogs over the lanes/fields mutations.

**Tech Stack:** React pointer events, date-fns (via `snapDate`), Convex `useMutation`, `radix-ui` Dialog.

**Depends on:** Phases 0–4.

---

## File structure for this phase

- Modify: `src/lib/timeline.ts` — add `resolveDrag`
- Modify: `src/lib/__tests__/timeline.test.ts` — cover `resolveDrag`
- Modify: `src/components/timeline/ItemBar.tsx` — drag/resize handles + keyboard nudge
- Modify: `src/components/timeline/LaneRow.tsx` — pass drag props through
- Modify: `src/components/timeline/TimelineView.tsx` — `onItemDatesChange`, run `resolveDrag`
- Modify: `src/routes/roadmaps/$id.tsx` — provide the dates-change mutation + open managers
- Create: `src/components/lanes/LaneManager.tsx`
- Create: `src/components/fields/FieldManager.tsx`
- Create: `src/components/milestones/MilestoneManager.tsx`
- Create: `src/components/roadmaps/RoadmapSettingsDialog.tsx`

---

### Task 1: `resolveDrag` (TDD)

**Files:**
- Modify: `src/lib/timeline.ts`
- Modify: `src/lib/__tests__/timeline.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/__tests__/timeline.test.ts`:

```ts
import { resolveDrag } from "../timeline";

test("resolveDrag move preserves duration and snaps start to a month", () => {
	const ws = ms(2026, 0, 1);
	const we = ms(2026, 11, 31);
	const item = { startDate: ms(2026, 1, 10), endDate: ms(2026, 2, 10) };
	const axisWidth = 1200;
	const out = resolveDrag("move", item, axisWidth / 12, ws, we, axisWidth, "month");
	// start snapped to a month boundary
	expect(new Date(out.startDate).getDate()).toBe(1);
	// duration preserved
	expect(out.endDate - out.startDate).toBe(item.endDate - item.startDate);
});

test("resolveDrag resize-end keeps start and extends end", () => {
	const ws = ms(2026, 0, 1);
	const we = ms(2026, 11, 31);
	const item = { startDate: ms(2026, 1, 1), endDate: ms(2026, 2, 1) };
	const out = resolveDrag("resize-end", item, 200, ws, we, 1200, "month");
	expect(out.startDate).toBe(item.startDate);
	expect(out.endDate).toBeGreaterThan(item.startDate);
});

test("resolveDrag resize-start never crosses the end", () => {
	const ws = ms(2026, 0, 1);
	const we = ms(2026, 11, 31);
	const item = { startDate: ms(2026, 1, 1), endDate: ms(2026, 2, 1) };
	const out = resolveDrag("resize-start", item, 5000, ws, we, 1200, "month");
	expect(out.startDate).toBeLessThan(item.endDate);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: FAIL — `resolveDrag` is not exported.

- [ ] **Step 3: Implement `resolveDrag`**

Append to `src/lib/timeline.ts`:

```ts
export type DragMode = "move" | "resize-start" | "resize-end";

export function resolveDrag(
	mode: DragMode,
	item: { startDate: number; endDate: number },
	deltaX: number,
	windowStart: number,
	windowEnd: number,
	axisWidth: number,
	zoom: Zoom,
): { startDate: number; endDate: number } {
	const span = windowEnd - windowStart || 1;
	const deltaMs = (deltaX / (axisWidth || 1)) * span;

	if (mode === "move") {
		const duration = item.endDate - item.startDate;
		const start = snapDate(item.startDate + deltaMs, zoom, "start");
		return { startDate: start, endDate: start + duration };
	}
	if (mode === "resize-start") {
		let start = snapDate(item.startDate + deltaMs, zoom, "start");
		if (start >= item.endDate) {
			start = snapDate(item.endDate - 1, zoom, "start");
		}
		return { startDate: start, endDate: item.endDate };
	}
	let end = snapDate(item.endDate + deltaMs, zoom, "end");
	if (end <= item.startDate) {
		end = snapDate(item.startDate + 1, zoom, "end");
	}
	return { startDate: item.startDate, endDate: end };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: PASS — all timeline tests including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/__tests__/timeline.test.ts
git commit -m "feat: resolveDrag snapped date computation"
```

---

### Task 2: Make ItemBar draggable

**Files:**
- Modify: `src/components/timeline/ItemBar.tsx`

- [ ] **Step 1: Replace ItemBar with a drag-aware version**

```tsx
import { useRef, useState } from "react";
import type { Doc } from "@convex/_generated/dataModel";
import type { DragMode } from "@/lib/timeline";

export function ItemBar({
	item,
	left,
	width,
	top,
	color,
	unitWidth,
	onSelect,
	onDragCommit,
}: {
	item: Doc<"items">;
	left: number;
	width: number;
	top: number;
	color: string;
	unitWidth: number;
	onSelect?: (id: Doc<"items">["_id"]) => void;
	onDragCommit?: (mode: DragMode, deltaX: number) => void;
}) {
	const [offset, setOffset] = useState<{ dx: number; dw: number }>({
		dx: 0,
		dw: 0,
	});
	const drag = useRef<{ mode: DragMode; startX: number } | null>(null);
	const editable = Boolean(onDragCommit);

	function begin(mode: DragMode, e: React.PointerEvent) {
		if (!editable) return;
		e.preventDefault();
		e.stopPropagation();
		(e.target as Element).setPointerCapture(e.pointerId);
		drag.current = { mode, startX: e.clientX };
	}

	function move(e: React.PointerEvent) {
		if (!drag.current) return;
		const dx = e.clientX - drag.current.startX;
		if (drag.current.mode === "move") setOffset({ dx, dw: 0 });
		else if (drag.current.mode === "resize-end") setOffset({ dx: 0, dw: dx });
		else setOffset({ dx, dw: -dx });
	}

	function end(e: React.PointerEvent) {
		if (!drag.current) return;
		const dx = e.clientX - drag.current.startX;
		const mode = drag.current.mode;
		drag.current = null;
		setOffset({ dx: 0, dw: 0 });
		if (Math.abs(dx) < 3) {
			onSelect?.(item._id);
			return;
		}
		onDragCommit?.(mode, dx);
	}

	return (
		<div
			role="button"
			tabIndex={0}
			onPointerDown={(e) => begin("move", e)}
			onPointerMove={move}
			onPointerUp={end}
			onKeyDown={(e) => {
				if (e.key === "Enter") onSelect?.(item._id);
				if (e.key === "ArrowRight") onDragCommit?.("move", unitWidth);
				if (e.key === "ArrowLeft") onDragCommit?.("move", -unitWidth);
			}}
			style={{
				left: left + offset.dx,
				width: Math.max(8, width + offset.dw),
				top,
				borderLeftColor: color,
			}}
			className="group absolute flex h-9 cursor-grab items-center overflow-hidden rounded-md border border-l-4 border-neutral-200 bg-white px-2 text-left text-xs shadow-sm hover:border-neutral-400 active:cursor-grabbing"
		>
			{editable ? (
				<span
					onPointerDown={(e) => begin("resize-start", e)}
					className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
				/>
			) : null}
			<span className="block truncate font-medium">{item.title}</span>
			{editable ? (
				<span
					onPointerDown={(e) => begin("resize-end", e)}
					className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
				/>
			) : null}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/timeline/ItemBar.tsx
git commit -m "feat: drag and resize item bars"
```

---

### Task 3: Thread drag commits through the view

**Files:**
- Modify: `src/components/timeline/LaneRow.tsx`
- Modify: `src/components/timeline/TimelineView.tsx`
- Modify: `src/routes/roadmaps/$id.tsx`

- [ ] **Step 1: LaneRow — forward `unitWidth` and `onItemDrag`**

Add these props to `LaneRow`'s parameter type:

```tsx
	unitWidth: number;
	onItemDrag?: (item: Doc<"items">, mode: import("@/lib/timeline").DragMode, deltaX: number) => void;
```

And pass them to each `ItemBar`:

```tsx
<ItemBar
	key={item._id}
	item={item}
	left={geometries[i].left}
	width={geometries[i].width}
	top={rows[i] * (rowHeight + rowGap) + rowGap}
	color={colors[i]}
	unitWidth={unitWidth}
	onSelect={onSelect}
	onDragCommit={
		onItemDrag ? (mode, deltaX) => onItemDrag(item, mode, deltaX) : undefined
	}
/>
```

- [ ] **Step 2: TimelineView — add `onItemDatesChange` and run `resolveDrag`**

Add the prop to `TimelineView`:

```tsx
	onItemDatesChange?: (
		itemId: Doc<"items">["_id"],
		startDate: number,
		endDate: number,
	) => void;
```

Import `resolveDrag`:

```tsx
import { resolveDrag } from "@/lib/timeline";
```

Inside the component, build the per-item handler and pass `COLUMN_WIDTH` + handler to each `LaneRow`:

```tsx
const handleItemDrag = onItemDatesChange
	? (item: Doc<"items">, mode: import("@/lib/timeline").DragMode, deltaX: number) => {
			const next = resolveDrag(
				mode,
				item,
				deltaX,
				windowStart,
				windowEnd,
				axisWidth,
				zoom,
			);
			onItemDatesChange(item._id, next.startDate, next.endDate);
		}
	: undefined;
```

In the `<LaneRow … />` JSX add:

```tsx
unitWidth={COLUMN_WIDTH}
onItemDrag={handleItemDrag}
```

- [ ] **Step 3: Route — pass the mutation handler**

In `src/routes/roadmaps/$id.tsx`, add:

```tsx
import { useMutation } from "convex/react";
```

Inside `RoadmapEditor`, before the return:

```tsx
const updateItem = useMutation(api.items.update);
```

And pass to `<TimelineView>`:

```tsx
onItemDatesChange={(itemId, startDate, endDate) =>
	updateItem({ itemId, startDate, endDate })
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev:all`. Drag a bar → it snaps to the zoom unit and persists in real time. Drag the right edge → resizes. Select a bar and press ←/→ → it nudges one unit. A < 3px drag is treated as a click (opens the editor).

- [ ] **Step 5: Lint + commit**

```bash
npm run check
git add src/components/timeline/LaneRow.tsx src/components/timeline/TimelineView.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat: persist drag/resize via items.update"
```

---

### Task 4: Lane manager

**Files:**
- Create: `src/components/lanes/LaneManager.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` — add a "Lanes" button that opens it

- [ ] **Step 1: Implement `LaneManager.tsx`**

```tsx
import { useState } from "react";
import { Dialog } from "radix-ui";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

export function LaneManager({
	roadmapId,
	lanes,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	lanes: Doc<"lanes">[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const createLane = useMutation(api.lanes.create);
	const updateLane = useMutation(api.lanes.update);
	const removeLane = useMutation(api.lanes.remove);
	const [newName, setNewName] = useState("");

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">Lanes</Dialog.Title>
					<div className="mt-4 space-y-2">
						{lanes.map((lane) => (
							<div key={lane._id} className="flex items-center gap-2">
								<input
									className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
									defaultValue={lane.name}
									onBlur={(e) =>
										e.target.value !== lane.name &&
										updateLane({ laneId: lane._id, name: e.target.value })
									}
								/>
								<button
									type="button"
									disabled={lanes.length <= 1 || lane.isDefault}
									title={
										lane.isDefault ? "The default lane cannot be deleted" : "Delete"
									}
									onClick={() => {
										const target = lanes.find((l) => l._id !== lane._id);
										if (target)
											removeLane({ laneId: lane._id, moveToLaneId: target._id });
									}}
									className="text-neutral-500 disabled:opacity-30"
								>
									<Trash2 size={16} />
								</button>
							</div>
						))}
					</div>
					<div className="mt-4 flex gap-2">
						<input
							className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
							placeholder="New lane name"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<button
							type="button"
							onClick={async () => {
								if (!newName.trim()) return;
								await createLane({ roadmapId, name: newName.trim() });
								setNewName("");
							}}
							className="flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
						>
							<Plus size={14} /> Add
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

> Deleting a lane reassigns its items to the first other lane (matching the spec's "move to another lane"). A richer target picker can replace `lanes.find(...)` later; the backend already guards against deleting the last lane.

- [ ] **Step 2: Open it from the route**

In `src/routes/roadmaps/$id.tsx`, add `const [lanesOpen, setLanesOpen] = useState(false);`, a header button `onClick={() => setLanesOpen(true)}` labeled "Lanes", and render:

```tsx
<LaneManager
	roadmapId={roadmapId}
	lanes={bundle.lanes}
	open={lanesOpen}
	onOpenChange={setLanesOpen}
/>
```

with `import { LaneManager } from "@/components/lanes/LaneManager";`.

- [ ] **Step 3: Verify + commit**

Run: `npm run dev:all`. Add a lane, rename one, delete a non-default lane (its items move to another lane), confirm the default lane's delete is disabled.

```bash
npm run check
git add src/components/lanes/LaneManager.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat: lane manager dialog"
```

---

### Task 5: Field manager

**Files:**
- Create: `src/components/fields/FieldManager.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` — add a "Fields" button

- [ ] **Step 1: Implement `FieldManager.tsx`**

Supports adding a field (with type), renaming, toggling `showInTable`, editing select options (label + color), and removing non-system fields. Option ids are generated from labels.

```tsx
import { useState } from "react";
import { Dialog } from "radix-ui";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

const TYPES = ["text", "number", "date", "select", "multiselect"] as const;

function slug(label: string): string {
	return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
}

export function FieldManager({
	roadmapId,
	fields,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	fields: Doc<"fields">[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const createField = useMutation(api.fields.create);
	const updateField = useMutation(api.fields.update);
	const removeField = useMutation(api.fields.remove);
	const [label, setLabel] = useState("");
	const [type, setType] = useState<(typeof TYPES)[number]>("text");

	async function addField() {
		if (!label.trim()) return;
		const order = fields.reduce((m, f) => Math.max(m, f.order), -1) + 1;
		await createField({
			roadmapId,
			key: `${slug(label)}_${order}`,
			label: label.trim(),
			type,
			options:
				type === "select" || type === "multiselect"
					? [{ id: "option_1", label: "Option 1", color: "#9bc2e0" }]
					: undefined,
			showInTable: true,
			order,
		});
		setLabel("");
		setType("text");
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(560px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">Fields</Dialog.Title>
					<div className="mt-4 space-y-3">
						{[...fields]
							.sort((a, b) => a.order - b.order)
							.map((field) => (
								<div
									key={field._id}
									className="rounded-md border border-neutral-200 p-3"
								>
									<div className="flex items-center gap-2">
										<input
											className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
											defaultValue={field.label}
											onBlur={(e) =>
												e.target.value !== field.label &&
												updateField({ fieldId: field._id, label: e.target.value })
											}
										/>
										<span className="font-mono text-xs text-neutral-500">
											{field.type}
										</span>
										<label className="flex items-center gap-1 text-xs">
											<input
												type="checkbox"
												defaultChecked={field.showInTable}
												onChange={(e) =>
													updateField({
														fieldId: field._id,
														showInTable: e.target.checked,
													})
												}
											/>
											table
										</label>
										<button
											type="button"
											disabled={field.isSystem}
											title={field.isSystem ? "System field" : "Delete"}
											onClick={() => removeField({ fieldId: field._id })}
											className="text-neutral-500 disabled:opacity-30"
										>
											<Trash2 size={16} />
										</button>
									</div>

									{field.options ? (
										<div className="mt-2 space-y-1">
											{field.options.map((opt, idx) => (
												<div key={opt.id} className="flex items-center gap-2">
													<input
														type="color"
														defaultValue={opt.color}
														onBlur={(e) => {
															const options = field.options!.map((o, i) =>
																i === idx ? { ...o, color: e.target.value } : o,
															);
															updateField({ fieldId: field._id, options });
														}}
													/>
													<input
														className="flex-1 rounded-md border border-neutral-200 px-2 py-1 text-sm"
														defaultValue={opt.label}
														onBlur={(e) => {
															const options = field.options!.map((o, i) =>
																i === idx ? { ...o, label: e.target.value } : o,
															);
															updateField({ fieldId: field._id, options });
														}}
													/>
												</div>
											))}
											<button
												type="button"
												onClick={() => {
													const n = (field.options?.length ?? 0) + 1;
													const options = [
														...(field.options ?? []),
														{
															id: `option_${n}`,
															label: `Option ${n}`,
															color: "#cccccc",
														},
													];
													updateField({ fieldId: field._id, options });
												}}
												className="flex items-center gap-1 text-xs text-neutral-600"
											>
												<Plus size={12} /> Add option
											</button>
										</div>
									) : null}
								</div>
							))}
					</div>

					<div className="mt-4 flex items-end gap-2 border-t border-neutral-200 pt-4">
						<label className="flex-1 text-sm">
							New field
							<input
								className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
							/>
						</label>
						<select
							className="rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
							value={type}
							onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
						>
							{TYPES.map((t) => (
								<option key={t} value={t}>
									{t}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={addField}
							className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
						>
							Add
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 2: Open it from the route**

Add `const [fieldsOpen, setFieldsOpen] = useState(false);`, a "Fields" header button, and render `<FieldManager roadmapId={roadmapId} fields={bundle.fields} open={fieldsOpen} onOpenChange={setFieldsOpen} />` with the matching import.

- [ ] **Step 3: Verify + commit**

Run: `npm run dev:all`. Add a `select` field "Team" with options, mark it table-visible; it appears in the item editor. Rename the system Status field's options/colors and watch bar colors update. Confirm Status can't be deleted.

```bash
npm run check
git add src/components/fields/FieldManager.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat: custom field manager dialog"
```

---

### Task 6: Milestone manager

**Files:**
- Create: `src/components/milestones/MilestoneManager.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` — add a "Milestones" button

- [ ] **Step 1: Implement `MilestoneManager.tsx`**

```tsx
import { useState } from "react";
import { Dialog } from "radix-ui";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { dateInputToMs, msToDateInput } from "@/lib/fields";

export function MilestoneManager({
	roadmapId,
	milestones,
	open,
	onOpenChange,
}: {
	roadmapId: Id<"roadmaps">;
	milestones: Doc<"milestones">[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const createMilestone = useMutation(api.milestones.create);
	const updateMilestone = useMutation(api.milestones.update);
	const removeMilestone = useMutation(api.milestones.remove);
	const [name, setName] = useState("");
	const [date, setDate] = useState("");

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">Milestones</Dialog.Title>
					<div className="mt-4 space-y-2">
						{milestones.map((m) => (
							<div key={m._id} className="flex items-center gap-2">
								<input
									className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
									defaultValue={m.name}
									onBlur={(e) =>
										e.target.value !== m.name &&
										updateMilestone({ milestoneId: m._id, name: e.target.value })
									}
								/>
								<input
									type="date"
									className="rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
									defaultValue={msToDateInput(m.date)}
									onChange={(e) =>
										e.target.value &&
										updateMilestone({
											milestoneId: m._id,
											date: dateInputToMs(e.target.value),
										})
									}
								/>
								<button
									type="button"
									onClick={() => removeMilestone({ milestoneId: m._id })}
									className="text-neutral-500"
								>
									<Trash2 size={16} />
								</button>
							</div>
						))}
					</div>
					<div className="mt-4 flex items-end gap-2 border-t border-neutral-200 pt-4">
						<label className="flex-1 text-sm">
							Name
							<input
								className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</label>
						<label className="text-sm">
							Date
							<input
								type="date"
								className="mt-1 rounded-md border border-neutral-200 px-2 py-1.5"
								value={date}
								onChange={(e) => setDate(e.target.value)}
							/>
						</label>
						<button
							type="button"
							onClick={async () => {
								if (!name.trim() || !date) return;
								await createMilestone({
									roadmapId,
									name: name.trim(),
									date: dateInputToMs(date),
								});
								setName("");
								setDate("");
							}}
							className="flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
						>
							<Plus size={14} /> Add
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 2: Open it from the route**

In `src/routes/roadmaps/$id.tsx`, add `const [milestonesOpen, setMilestonesOpen] = useState(false);`, a "Milestones" header button, and render `<MilestoneManager roadmapId={roadmapId} milestones={bundle.milestones} open={milestonesOpen} onOpenChange={setMilestonesOpen} />` with the matching import.

- [ ] **Step 3: Verify + commit**

Run: `npm run dev:all`. Add a milestone with a date inside the window → a marker appears on the timeline at that date; rename it; delete it.

```bash
npm run check
git add src/components/milestones/MilestoneManager.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat: milestone manager dialog"
```

---

### Task 7: Roadmap settings dialog

**Files:**
- Create: `src/components/roadmaps/RoadmapSettingsDialog.tsx`
- Modify: `src/routes/roadmaps/$id.tsx` — add a "Settings" button

Lets the owner rename the roadmap, adjust the timeframe window, set the default zoom, and choose which select field colors the bars (`colorByFieldKey`, per spec §10).

- [ ] **Step 1: Implement `RoadmapSettingsDialog.tsx`**

```tsx
import { Dialog } from "radix-ui";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { dateInputToMs, msToDateInput } from "@/lib/fields";
import type { Zoom } from "@/lib/timeline";

const ZOOMS: Zoom[] = ["week", "month", "quarter", "half"];

export function RoadmapSettingsDialog({
	roadmap,
	fields,
	open,
	onOpenChange,
}: {
	roadmap: Doc<"roadmaps">;
	fields: Doc<"fields">[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const update = useMutation(api.roadmaps.update);
	const selectFields = fields.filter(
		(f) => f.type === "select" || f.type === "multiselect",
	);
	const base = "mt-1 w-full rounded-md border border-neutral-200 px-2 py-2 text-sm";

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
					<Dialog.Title className="text-base font-semibold">Roadmap settings</Dialog.Title>
					<label className="block text-sm">
						Name
						<input
							className={base}
							defaultValue={roadmap.name}
							onBlur={(e) =>
								e.target.value !== roadmap.name &&
								update({ roadmapId: roadmap._id, name: e.target.value })
							}
						/>
					</label>
					<div className="grid grid-cols-2 gap-2">
						<label className="block text-sm">
							Start
							<input
								type="date"
								className={base}
								defaultValue={msToDateInput(roadmap.startDate)}
								onChange={(e) =>
									e.target.value &&
									update({ roadmapId: roadmap._id, startDate: dateInputToMs(e.target.value) })
								}
							/>
						</label>
						<label className="block text-sm">
							End
							<input
								type="date"
								className={base}
								defaultValue={msToDateInput(roadmap.endDate)}
								onChange={(e) =>
									e.target.value &&
									update({ roadmapId: roadmap._id, endDate: dateInputToMs(e.target.value) })
								}
							/>
						</label>
					</div>
					<label className="block text-sm">
						Default zoom
						<select
							className={base}
							defaultValue={roadmap.defaultZoom}
							onChange={(e) =>
								update({ roadmapId: roadmap._id, defaultZoom: e.target.value as Zoom })
							}
						>
							{ZOOMS.map((z) => (
								<option key={z} value={z}>
									{z}
								</option>
							))}
						</select>
					</label>
					<label className="block text-sm">
						Color items by
						<select
							className={base}
							defaultValue={roadmap.colorByFieldKey ?? ""}
							onChange={(e) =>
								update({ roadmapId: roadmap._id, colorByFieldKey: e.target.value })
							}
						>
							{selectFields.map((f) => (
								<option key={f._id} value={f.key}>
									{f.label}
								</option>
							))}
						</select>
					</label>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

- [ ] **Step 2: Open it from the route**

Add `const [settingsOpen, setSettingsOpen] = useState(false);`, a "Settings" header button, and render `<RoadmapSettingsDialog roadmap={bundle.roadmap} fields={bundle.fields} open={settingsOpen} onOpenChange={setSettingsOpen} />` with the matching import.

- [ ] **Step 3: Verify + commit**

Run: `npm run dev:all`. Rename the roadmap, change the window dates (axis re-buckets), switch default zoom, and change color-by to another select field (bar colors update). Reload to confirm persistence.

```bash
npm run check
git add src/components/roadmaps/RoadmapSettingsDialog.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat: roadmap settings dialog"
```

---

## Self-review notes

- **Spec coverage:** drag-to-reschedule + resize with snap-to-unit (§6) ✓; keyboard nudge a11y (§6) ✓; lane management with move-on-delete + default-lane guard (§4) ✓; field manager: add/rename/recolor options/showInTable/remove non-system (§3, §5) ✓; milestone create/edit/delete UI (§1 MVP surface, §4) ✓; roadmap settings — rename, timeframe, default zoom, configurable `colorByFieldKey` (§10) ✓.
- **Type consistency:** `resolveDrag`/`DragMode` reused by `ItemBar` → `LaneRow` → `TimelineView`. `onItemDatesChange` is optional, so `TimelineView` stays read-only for Phase 7's share view. Field option ids are stable strings; editing labels/colors preserves ids so existing item values stay valid.
- **Note:** editing a select field's option ids is intentionally not exposed (only labels/colors), preventing orphaned item values. Removing a whole field strips its values server-side (Phase 1 `fields.remove`).

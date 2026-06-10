# Timeline UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship seven UX refinements to the roadmap timeline editor and share view — predictable snapping with live feedback, a year band on the X axis, a consistent header, inline lane/item creation, optional whole-bar fill, visible milestone names, and a read-only-friendly share view.

**Architecture:** New pure helpers land in `src/lib/timeline.ts` (the tested core); a single optional `barColorMode` setting threads through the Convex schema, mutations, snapshots and JSON IO; the timeline components (`TimeAxis`, `ItemBar`, `TimelineView`, `LaneRow`, `MilestoneMarker`) consume those helpers. Drag preview/guide and inline-add are wired through `TimelineView` down to `ItemBar`/`LaneRow`.

**Tech Stack:** React 19 + TanStack Start, Convex, `radix-ui` (unified package), date-fns, Zod, Vitest, Biome (tabs + double quotes).

**Conventions reminder:** Biome uses **tab** indentation and **double** quotes. Run `npm run check` before each commit. After editing anything in `convex/`, run `npx convex dev --once` to regenerate `convex/_generated` and typecheck. Each commit message ends with the `Co-Authored-By` trailer shown in the steps.

---

## Task 1: Adaptive snapping + year-band + zoom-width helpers (`src/lib/timeline.ts`)

**Files:**
- Modify: `src/lib/timeline.ts`
- Test: `src/lib/__tests__/timeline.test.ts`

This task generalizes `snapDate` to a snap *unit*, derives that unit from zoom (`snapGranularity`), makes `resolveDrag` use it, adds `yearBands` and `columnWidth`, and drops the year from `half` labels (it moves to the new year band).

- [ ] **Step 1: Update the existing tests to the new behavior, and add tests for the new helpers**

In `src/lib/__tests__/timeline.test.ts`, update the import to add the new helpers:

```ts
import {
	buildPeriods,
	columnWidth,
	dateToX,
	itemGeometry,
	laneAtY,
	laneLayout,
	packLanes,
	resolveDrag,
	snapDate,
	snapGranularity,
	xToDate,
	yearBands,
} from "../timeline";
```

Replace the `buildPeriods: halves` test's expectation (year now lives in the band):

```ts
test("buildPeriods: halves across 2026-2027", () => {
	const periods = buildPeriods(ms(2026, 0, 1), ms(2027, 11, 31), "half");
	expect(periods.map((p) => p.label)).toEqual(["H1", "H2", "H1", "H2"]);
});
```

Replace the `snapDate snaps to month edges` test (signature is now a snap unit):

```ts
test("snapDate snaps to the given unit edges", () => {
	const mid = ms(2026, 2, 14);
	expect(snapDate(mid, "month", "start")).toBe(ms(2026, 2, 1));
	expect(new Date(snapDate(mid, "month", "end")).getMonth()).toBe(2);
	// day unit snaps to start/end of that calendar day
	expect(snapDate(mid, "day", "start")).toBe(ms(2026, 2, 14));
	// week unit (Mon-start) lands on a Monday
	expect(new Date(snapDate(mid, "week", "start")).getDay()).toBe(1);
});
```

Replace the `resolveDrag move ... snaps start to a month` test (month zoom now snaps one tier finer → week):

```ts
test("resolveDrag move preserves duration and snaps start to a week at month zoom", () => {
	const ws = ms(2026, 0, 1);
	const we = ms(2026, 11, 31);
	const item = { startDate: ms(2026, 1, 10), endDate: ms(2026, 2, 10) };
	const axisWidth = 1200;
	const out = resolveDrag("move", item, axisWidth / 12, ws, we, axisWidth, "month");
	expect(new Date(out.startDate).getDay()).toBe(1); // Monday (week start)
	expect(out.endDate - out.startDate).toBe(item.endDate - item.startDate);
});
```

Add new tests at the end of the file:

```ts
test("snapGranularity maps each zoom one tier finer", () => {
	expect(snapGranularity("week")).toBe("day");
	expect(snapGranularity("month")).toBe("week");
	expect(snapGranularity("quarter")).toBe("month");
	expect(snapGranularity("half")).toBe("month");
});

test("yearBands groups consecutive periods by calendar year", () => {
	const periods = buildPeriods(ms(2025, 10, 1), ms(2026, 2, 28), "month");
	// Nov 2025, Dec 2025, Jan 2026, Feb 2026, Mar 2026
	expect(yearBands(periods)).toEqual([
		{ label: "2025", columnSpan: 2 },
		{ label: "2026", columnSpan: 3 },
	]);
});

test("columnWidth returns a per-zoom width", () => {
	expect(columnWidth("month")).toBeGreaterThan(0);
	expect(columnWidth("week")).toBeGreaterThan(0);
	expect(columnWidth("quarter")).toBeGreaterThan(0);
	expect(columnWidth("half")).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: FAIL — `snapGranularity`, `yearBands`, `columnWidth` are not exported; `snapDate`/`resolveDrag`/half-label assertions mismatch.

- [ ] **Step 3: Implement the changes in `src/lib/timeline.ts`**

Add `startOfDay` and `endOfDay` to the date-fns import (top of file):

```ts
import {
	eachMonthOfInterval,
	eachQuarterOfInterval,
	eachWeekOfInterval,
	endOfDay,
	endOfMonth,
	endOfQuarter,
	endOfWeek,
	format,
	getISOWeek,
	getQuarter,
	startOfDay,
	startOfMonth,
	startOfQuarter,
	startOfWeek,
} from "date-fns";
```

Change the `half` label in `buildPeriods` (drop the year):

```ts
		periods.push({
			start: s.getTime(),
			end: e.getTime(),
			label: s.getMonth() < 6 ? "H1" : "H2",
		});
```

Add the snap-unit type and `snapGranularity`, and replace `snapDate` (just below `itemGeometry`):

```ts
export type SnapUnit = "day" | "week" | "month";

/** The snap step one tier finer than the visible columns. */
export function snapGranularity(zoom: Zoom): SnapUnit {
	if (zoom === "week") return "day";
	if (zoom === "month") return "week";
	return "month"; // quarter, half
}

export function snapDate(
	date: number,
	unit: SnapUnit,
	edge: "start" | "end",
): number {
	const d = new Date(date);
	if (unit === "day") {
		return (edge === "start" ? startOfDay(d) : endOfDay(d)).getTime();
	}
	if (unit === "week") {
		return (
			edge === "start" ? startOfWeek(d, WEEK_OPTS) : endOfWeek(d, WEEK_OPTS)
		).getTime();
	}
	return (edge === "start" ? startOfMonth(d) : endOfMonth(d)).getTime();
}
```

Replace `resolveDrag` to derive the unit from zoom (signature unchanged):

```ts
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
	const unit = snapGranularity(zoom);

	if (mode === "move") {
		const duration = item.endDate - item.startDate;
		const start = snapDate(item.startDate + deltaMs, unit, "start");
		return { startDate: start, endDate: start + duration };
	}
	if (mode === "resize-start") {
		let start = snapDate(item.startDate + deltaMs, unit, "start");
		if (start >= item.endDate) {
			start = snapDate(item.endDate - 1, unit, "start");
		}
		return { startDate: start, endDate: item.endDate };
	}
	let end = snapDate(item.endDate + deltaMs, unit, "end");
	if (end <= item.startDate) {
		end = snapDate(item.startDate + 1, unit, "end");
	}
	return { startDate: item.startDate, endDate: end };
}
```

Add `yearBands` and `columnWidth` at the end of the file:

```ts
/** Consecutive periods grouped by calendar year, for the axis year band. */
export function yearBands(
	periods: Period[],
): { label: string; columnSpan: number }[] {
	const bands: { label: string; columnSpan: number }[] = [];
	for (const p of periods) {
		const label = String(new Date(p.start).getFullYear());
		const last = bands[bands.length - 1];
		if (last && last.label === label) last.columnSpan += 1;
		else bands.push({ label, columnSpan: 1 });
	}
	return bands;
}

/** Per-zoom column width in px. Narrower than the old fixed 140 to reduce horizontal scroll. */
export function columnWidth(zoom: Zoom): number {
	switch (zoom) {
		case "week":
			return 104;
		case "month":
			return 116;
		case "quarter":
			return 96;
		case "half":
			return 96;
	}
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/__tests__/timeline.test.ts
git commit -m "feat: adaptive snap unit, year-band + zoom-width timeline helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Readable text color for solid bar fill (`src/lib/roadmapColors.ts`)

**Files:**
- Modify: `src/lib/roadmapColors.ts`
- Test: `src/lib/__tests__/roadmapColors.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/roadmapColors.test.ts`:

```ts
import { expect, test } from "vitest";
import { readableTextOn } from "../roadmapColors";

test("readableTextOn picks dark text on light backgrounds", () => {
	expect(readableTextOn("#ffffff")).toBe("#1c1c1c");
	expect(readableTextOn("#e5e5e5")).toBe("#1c1c1c"); // neutral fallback fill
});

test("readableTextOn picks white text on dark/saturated backgrounds", () => {
	expect(readableTextOn("#1D9E75")).toBe("#ffffff"); // teal
	expect(readableTextOn("#042C53")).toBe("#ffffff"); // deep blue
});

test("readableTextOn handles 3-digit hex and bad input", () => {
	expect(readableTextOn("#fff")).toBe("#1c1c1c");
	expect(readableTextOn("not-a-color")).toBe("#1c1c1c");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/roadmapColors.test.ts`
Expected: FAIL with "readableTextOn is not a function" (not exported).

- [ ] **Step 3: Add the implementation**

Append to `src/lib/roadmapColors.ts`:

```ts
/** Picks a legible text color (near-black or white) for a solid background `hex`. */
export function readableTextOn(hex: string): string {
	const c = hex.replace("#", "");
	const full =
		c.length === 3
			? c
					.split("")
					.map((x) => x + x)
					.join("")
			: c;
	const r = Number.parseInt(full.slice(0, 2), 16);
	const g = Number.parseInt(full.slice(2, 4), 16);
	const b = Number.parseInt(full.slice(4, 6), 16);
	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "#1c1c1c";
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return lum > 0.6 ? "#1c1c1c" : "#ffffff";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/roadmapColors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roadmapColors.ts src/lib/__tests__/roadmapColors.test.ts
git commit -m "feat: readableTextOn for legible solid-fill bar labels

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `barColorMode` schema + mutations + snapshots (`convex/`)

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/roadmaps.ts`
- Modify: `convex/lib/snapshot.ts`
- Test: `convex/roadmaps.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `convex/roadmaps.test.ts`:

```ts
test("update sets barColorMode and getBundle returns it", async () => {
	const t = convexTest(schema, modules);
	const roadmapId = await t
		.withIdentity({ subject: "user_bar" })
		.mutation(api.roadmaps.create, { name: "Bars", startDate: 0, endDate: 100 });

	await t
		.withIdentity({ subject: "user_bar" })
		.mutation(api.roadmaps.update, { roadmapId, barColorMode: "fill" });

	const bundle = await t
		.withIdentity({ subject: "user_bar" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.roadmap.barColorMode).toBe("fill");
});
```

> If `convex/roadmaps.test.ts` does not already import `convexTest`, `expect`, `test`, `api`, `schema`, and define `const modules = import.meta.glob("./**/*.ts");`, mirror the imports at the top of `convex/io.test.ts`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run convex/roadmaps.test.ts`
Expected: FAIL — `barColorMode` is not an accepted arg / not present on the roadmap.

- [ ] **Step 3: Add the validator and schema field**

In `convex/schema.ts`, add a shared validator next to `zoomValidator`:

```ts
export const barColorModeValidator = v.union(
	v.literal("left"),
	v.literal("fill"),
);
```

Add the field to the `roadmaps` table definition (after `colorByFieldKey`):

```ts
		colorByFieldKey: v.optional(v.string()),
		barColorMode: v.optional(barColorModeValidator),
```

Add it to `roadmapSnapshotValidator` (after its `colorByFieldKey` line):

```ts
		colorByFieldKey: v.optional(v.string()),
		barColorMode: v.optional(barColorModeValidator),
```

- [ ] **Step 4: Accept it in mutations**

In `convex/roadmaps.ts`, update the import from `./schema`:

```ts
import { barColorModeValidator, zoomValidator } from "./schema";
```

Add to the `update` mutation args (after `colorByFieldKey`):

```ts
		colorByFieldKey: v.optional(v.string()),
		barColorMode: v.optional(barColorModeValidator),
```

In the `duplicate` mutation, add `barColorMode` to the new roadmap insert (after `colorByFieldKey: roadmap.colorByFieldKey,`):

```ts
			colorByFieldKey: roadmap.colorByFieldKey,
			barColorMode: roadmap.barColorMode,
```

- [ ] **Step 5: Carry it through snapshots**

In `convex/lib/snapshot.ts`, in `snapshotRoadmap`'s returned object add (after `colorByFieldKey: roadmap.colorByFieldKey,`):

```ts
		colorByFieldKey: roadmap.colorByFieldKey,
		barColorMode: roadmap.barColorMode,
```

In `applySnapshot`'s `ctx.db.patch(roadmapId, {...})` add (after `colorByFieldKey: snapshot.colorByFieldKey,`):

```ts
		colorByFieldKey: snapshot.colorByFieldKey,
		barColorMode: snapshot.barColorMode,
```

- [ ] **Step 6: Regenerate Convex types and typecheck**

Run: `npx convex dev --once`
Expected: deploys, regenerates `convex/_generated`, no type errors.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run convex/roadmaps.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add convex/schema.ts convex/roadmaps.ts convex/lib/snapshot.ts convex/roadmaps.test.ts convex/_generated
git commit -m "feat: barColorMode setting on roadmaps, snapshots and mutations

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `barColorMode` JSON round-trip (`src/lib/roadmapIO.ts`)

**Files:**
- Modify: `src/lib/roadmapIO.ts`
- Test: `src/lib/__tests__/roadmapIO.test.ts` (append; create if absent)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/roadmapIO.test.ts` (create the file with this content if it does not exist):

```ts
import { expect, test } from "vitest";
import { parseImport, serializeRoadmap } from "../roadmapIO";
import type { TimelineBundle } from "@/components/timeline/TimelineView";

const baseRoadmap = {
	_id: "rm1" as never,
	_creationTime: 0,
	userId: "u",
	name: "RM",
	startDate: 0,
	endDate: 100,
	defaultZoom: "month" as const,
	visibility: "private" as const,
	archived: false,
	barColorMode: "fill" as const,
};

test("serializeRoadmap includes barColorMode and parseImport round-trips it", () => {
	const bundle = {
		roadmap: baseRoadmap,
		fields: [],
		lanes: [],
		items: [],
		milestones: [],
	} as unknown as TimelineBundle;
	const json = JSON.stringify(serializeRoadmap(bundle));
	const parsed = parseImport(json);
	expect(parsed.barColorMode).toBe("fill");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/roadmapIO.test.ts`
Expected: FAIL — `parsed.barColorMode` is `undefined` (not serialized / not in schema).

- [ ] **Step 3: Add it to the schema and serializer**

In `src/lib/roadmapIO.ts`, add to `roadmapExportSchema` (after the `colorByFieldKey` line):

```ts
		colorByFieldKey: z.string().optional(),
		barColorMode: z.enum(["left", "fill"]).optional(),
```

Add to the object returned by `serializeRoadmap` (after `colorByFieldKey: bundle.roadmap.colorByFieldKey,`):

```ts
		colorByFieldKey: bundle.roadmap.colorByFieldKey,
		barColorMode: bundle.roadmap.barColorMode,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/roadmapIO.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roadmapIO.ts src/lib/__tests__/roadmapIO.test.ts
git commit -m "feat: round-trip barColorMode through JSON import/export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Two-tier year band in `TimeAxis`

**Files:**
- Modify: `src/components/timeline/TimeAxis.tsx`

This is presentational; verify by typecheck/build + visual check.

- [ ] **Step 1: Replace `TimeAxis.tsx` with the two-tier version**

```tsx
import { type Period, yearBands } from "@/lib/timeline";
import { cn } from "@/lib/utils";

export function TimeAxis({
	periods,
	columnWidth,
	labelWidth,
}: {
	periods: Period[];
	columnWidth: number;
	labelWidth: number;
}) {
	const bands = yearBands(periods);
	return (
		<div className="sticky top-0 z-10 bg-neutral-50">
			<div className="flex border-b border-neutral-200">
				<div
					style={{ width: labelWidth }}
					className="shrink-0 border-r border-neutral-200"
				/>
				{bands.map((b, i) => (
					<div
						key={b.label}
						style={{ width: b.columnSpan * columnWidth }}
						className={cn(
							"shrink-0 border-r border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-500",
							i > 0 && "border-l-2 border-l-neutral-300",
						)}
					>
						{b.label}
					</div>
				))}
			</div>
			<div className="flex border-b border-neutral-200">
				<div
					style={{ width: labelWidth }}
					className="shrink-0 border-r border-neutral-200"
				/>
				{periods.map((p, idx) => {
					const newYear =
						idx > 0 &&
						new Date(p.start).getFullYear() !==
							new Date(periods[idx - 1].start).getFullYear();
					return (
						<div
							key={p.start}
							style={{ width: columnWidth }}
							className={cn(
								"shrink-0 border-r border-neutral-200 px-2 py-2 font-mono text-[11px] uppercase tracking-wide text-neutral-500",
								newYear && "border-l-2 border-l-neutral-400",
							)}
						>
							{p.label}
						</div>
					);
				})}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: no errors. (`columnWidth` prop is still a number; `TimelineView` passes the computed value in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/TimeAxis.tsx
git commit -m "feat: two-tier axis with sticky year band

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Solid fill, cursor fix, and live snap preview in `ItemBar`

**Files:**
- Modify: `src/components/timeline/ItemBar.tsx`

`ItemBar` gains: a `colorMode` prop (`"left"` keeps today's left-line look, `"fill"` paints the whole bar with legible text), a non-grab cursor when read-only, and a `previewGeometry`/`onDragMove` pair so the bar renders at the **snapped** position during a drag (instead of free-following the cursor) while `TimelineView` draws the guide line.

- [ ] **Step 1: Replace `ItemBar.tsx`**

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import { useRef, useState } from "react";
import { readableTextOn } from "@/lib/roadmapColors";
import type { DragMode } from "@/lib/timeline";
import { cn } from "@/lib/utils";

export function ItemBar({
	item,
	left,
	width,
	top,
	color,
	colorMode,
	unitWidth,
	onSelect,
	onDragCommit,
	onDragMove,
	previewGeometry,
}: {
	item: Doc<"items">;
	left: number;
	width: number;
	top: number;
	color: string;
	colorMode: "left" | "fill";
	unitWidth: number;
	onSelect?: (id: Doc<"items">["_id"]) => void;
	onDragCommit?: (mode: DragMode, deltaX: number, clientY: number) => void;
	onDragMove?: (mode: DragMode, deltaX: number) => void;
	previewGeometry?: (
		mode: DragMode,
		deltaX: number,
	) => { left: number; width: number };
}) {
	const [preview, setPreview] = useState<{ left: number; width: number } | null>(
		null,
	);
	const [dy, setDy] = useState(0);
	const [dragging, setDragging] = useState(false);
	const drag = useRef<{ mode: DragMode; startX: number; startY: number } | null>(
		null,
	);
	const editable = Boolean(onDragCommit);
	const fill = colorMode === "fill";

	function begin(mode: DragMode, e: React.PointerEvent) {
		if (!editable) return;
		e.preventDefault();
		e.stopPropagation();
		(e.target as Element).setPointerCapture(e.pointerId);
		drag.current = { mode, startX: e.clientX, startY: e.clientY };
		setDragging(true);
	}

	function move(e: React.PointerEvent) {
		if (!drag.current) return;
		const dx = e.clientX - drag.current.startX;
		const mode = drag.current.mode;
		setDy(mode === "move" ? e.clientY - drag.current.startY : 0);
		if (previewGeometry) setPreview(previewGeometry(mode, dx));
		onDragMove?.(mode, dx);
	}

	function end(e: React.PointerEvent) {
		if (!drag.current) return;
		const dx = e.clientX - drag.current.startX;
		const dyy = e.clientY - drag.current.startY;
		const mode = drag.current.mode;
		drag.current = null;
		setDragging(false);
		setPreview(null);
		setDy(0);
		if (Math.abs(dx) < 3 && Math.abs(dyy) < 3) {
			onSelect?.(item._id);
			return;
		}
		onDragCommit?.(mode, dx, e.clientY);
	}

	const renderLeft = preview ? preview.left : left;
	const renderWidth = Math.max(8, preview ? preview.width : width);

	return (
		// biome-ignore lint/a11y/useSemanticElements: a <button> can't legally contain the nested interactive resize handles; using role="button" with keyboard handlers instead
		<div
			role="button"
			tabIndex={0}
			onPointerDown={(e) => begin("move", e)}
			onPointerMove={move}
			onPointerUp={end}
			onKeyDown={(e) => {
				if (e.key === "Enter") onSelect?.(item._id);
				if (e.key === "ArrowRight") onDragCommit?.("move", unitWidth, Number.NaN);
				if (e.key === "ArrowLeft") onDragCommit?.("move", -unitWidth, Number.NaN);
			}}
			style={{
				left: renderLeft,
				width: renderWidth,
				top: top + dy,
				...(fill
					? {
							backgroundColor: color,
							color: readableTextOn(color),
							borderColor: color,
						}
					: { borderLeftColor: color }),
			}}
			className={cn(
				"group absolute flex h-9 items-center overflow-hidden rounded-md border px-2 text-left text-xs shadow-sm",
				fill ? "border" : "border-l-4 border-neutral-200 bg-white",
				editable
					? "cursor-grab hover:border-neutral-400 active:cursor-grabbing"
					: "cursor-default",
				dragging && "z-20 shadow-md",
			)}
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

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run check`
Expected: `ItemBar`'s callers (`LaneRow`) will type-error because `colorMode` is now required — that is fixed in Task 7. If running standalone, expect the `LaneRow` error only; otherwise proceed to Task 7 before committing.

- [ ] **Step 3: Commit (after Task 7 compiles) or bundle with Task 7**

```bash
git add src/components/timeline/ItemBar.tsx
git commit -m "feat: solid bar fill, read-only cursor, live snap preview in ItemBar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Tasks 6 and 7 are tightly coupled (props flow ItemBar↔LaneRow↔TimelineView). Implement Task 7 immediately after Task 6 and run the typecheck/build once both are in place; commit together if you prefer a single green commit.

---

## Task 7: Zoom-aware width, drag guide overlay, and fill threading in `TimelineView` + `LaneRow`

**Files:**
- Modify: `src/components/timeline/TimelineView.tsx`
- Modify: `src/components/timeline/LaneRow.tsx`

- [ ] **Step 1: Thread `colorMode`, preview, and guide through `LaneRow.tsx`**

Replace `src/components/timeline/LaneRow.tsx`:

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import type { DragMode } from "@/lib/timeline";
import { ItemBar } from "./ItemBar";

export function LaneRow({
	lane,
	items,
	rows,
	geometries,
	colors,
	colorMode,
	rowHeight,
	rowGap,
	labelWidth,
	axisWidth,
	unitWidth,
	onSelect,
	onItemDrag,
	onItemDragMove,
	previewGeometryFor,
	onAddItem,
	onAddItemAt,
}: {
	lane: Doc<"lanes">;
	items: Doc<"items">[];
	rows: number[];
	geometries: Array<{ left: number; width: number }>;
	colors: string[];
	colorMode: "left" | "fill";
	rowHeight: number;
	rowGap: number;
	labelWidth: number;
	axisWidth: number;
	unitWidth: number;
	onSelect?: (id: Doc<"items">["_id"]) => void;
	onItemDrag?: (
		item: Doc<"items">,
		mode: DragMode,
		deltaX: number,
		clientY: number,
	) => void;
	onItemDragMove?: (
		item: Doc<"items">,
		mode: DragMode,
		deltaX: number,
	) => void;
	previewGeometryFor?: (
		item: Doc<"items">,
		mode: DragMode,
		deltaX: number,
	) => { left: number; width: number };
	onAddItem?: (laneId: Doc<"lanes">["_id"]) => void;
	onAddItemAt?: (laneId: Doc<"lanes">["_id"], localX: number) => void;
}) {
	const depth = items.length ? Math.max(...rows) + 1 : 1;
	const height = depth * (rowHeight + rowGap) + rowGap;
	return (
		<div className="flex border-b border-neutral-200" style={{ height }}>
			<div
				style={{ width: labelWidth }}
				className="group/lane relative shrink-0 border-r border-neutral-200 bg-white p-2"
			>
				<strong className="text-[13px]">{lane.name}</strong>
				<span className="block font-mono text-[11px] text-neutral-500">
					{items.length} items
				</span>
				{onAddItem ? (
					<button
						type="button"
						aria-label={`Add item to ${lane.name}`}
						onClick={() => onAddItem(lane._id)}
						className="absolute right-2 top-2 hidden rounded border border-neutral-200 px-1.5 text-sm leading-5 text-neutral-500 hover:bg-neutral-100 group-hover/lane:block"
					>
						+
					</button>
				) : null}
			</div>
			<div
				className="relative"
				style={{ width: axisWidth }}
				onDoubleClick={(e) => {
					if (!onAddItemAt || e.target !== e.currentTarget) return;
					const rect = e.currentTarget.getBoundingClientRect();
					onAddItemAt(lane._id, e.clientX - rect.left);
				}}
			>
				{items.map((item, i) => (
					<ItemBar
						key={item._id}
						item={item}
						left={geometries[i].left}
						width={geometries[i].width}
						top={rows[i] * (rowHeight + rowGap) + rowGap}
						color={colors[i]}
						colorMode={colorMode}
						unitWidth={unitWidth}
						onSelect={onSelect}
						onDragCommit={
							onItemDrag
								? (mode, deltaX, clientY) =>
										onItemDrag(item, mode, deltaX, clientY)
								: undefined
						}
						onDragMove={
							onItemDragMove
								? (mode, deltaX) => onItemDragMove(item, mode, deltaX)
								: undefined
						}
						previewGeometry={
							previewGeometryFor
								? (mode, deltaX) => previewGeometryFor(item, mode, deltaX)
								: undefined
						}
					/>
				))}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Update `TimelineView.tsx`**

Replace `src/components/timeline/TimelineView.tsx`:

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import { useMemo, useRef, useState } from "react";
import { barColor } from "@/lib/roadmapColors";
import {
	buildPeriods,
	columnWidth,
	type DragMode,
	dateToX,
	itemGeometry,
	laneAtY,
	laneLayout,
	packLanes,
	resolveDrag,
	xToDate,
	type Zoom,
} from "@/lib/timeline";
import { AddLaneRow } from "./AddLaneRow";
import { LaneRow } from "./LaneRow";
import { MilestoneMarker } from "./MilestoneMarker";
import { TimeAxis } from "./TimeAxis";

export const LABEL_WIDTH = 170;
export const ROW_HEIGHT = 36;
export const ROW_GAP = 8;

export interface TimelineBundle {
	roadmap: Doc<"roadmaps">;
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	items: Doc<"items">[];
	milestones: Doc<"milestones">[];
}

export function TimelineView({
	bundle,
	zoom,
	onSelectItem,
	onItemDatesChange,
	onAddItem,
	onAddLane,
}: {
	bundle: TimelineBundle;
	zoom: Zoom;
	onSelectItem?: (id: Doc<"items">["_id"]) => void;
	onItemDatesChange?: (
		itemId: Doc<"items">["_id"],
		startDate: number,
		endDate: number,
		laneId?: Doc<"lanes">["_id"],
	) => void;
	onAddItem?: (laneId: Doc<"lanes">["_id"], startMs?: number) => void;
	onAddLane?: (name: string) => void;
}) {
	const { roadmap, fields, lanes, items, milestones } = bundle;
	const lanesRef = useRef<HTMLDivElement>(null);
	const [guideX, setGuideX] = useState<number | null>(null);

	const colW = columnWidth(zoom);
	const periods = useMemo(
		() => buildPeriods(roadmap.startDate, roadmap.endDate, zoom),
		[roadmap.startDate, roadmap.endDate, zoom],
	);
	const axisWidth = periods.length * colW;
	const windowStart = periods[0]?.start ?? roadmap.startDate;
	const windowEnd = periods[periods.length - 1]?.end ?? roadmap.endDate;
	const colorMode = roadmap.barColorMode ?? "left";

	const layout = useMemo(
		() => laneLayout(lanes, items, ROW_HEIGHT, ROW_GAP),
		[lanes, items],
	);
	const totalHeight = layout.at(-1)?.bottom ?? 0;

	const editable = Boolean(onItemDatesChange);

	const previewGeometryFor = editable
		? (item: Doc<"items">, mode: DragMode, deltaX: number) => {
				const next = resolveDrag(
					mode,
					item,
					deltaX,
					windowStart,
					windowEnd,
					axisWidth,
					zoom,
				);
				return itemGeometry(next, windowStart, windowEnd, axisWidth);
			}
		: undefined;

	const handleItemDragMove = editable
		? (item: Doc<"items">, mode: DragMode, deltaX: number) => {
				const next = resolveDrag(
					mode,
					item,
					deltaX,
					windowStart,
					windowEnd,
					axisWidth,
					zoom,
				);
				const edge = mode === "resize-end" ? next.endDate : next.startDate;
				setGuideX(dateToX(edge, windowStart, windowEnd, axisWidth));
			}
		: undefined;

	const handleItemDrag = onItemDatesChange
		? (item: Doc<"items">, mode: DragMode, deltaX: number, clientY: number) => {
				setGuideX(null);
				const next = resolveDrag(
					mode,
					item,
					deltaX,
					windowStart,
					windowEnd,
					axisWidth,
					zoom,
				);
				let laneId: Doc<"lanes">["_id"] | undefined;
				if (mode === "move" && lanesRef.current) {
					const top = lanesRef.current.getBoundingClientRect().top;
					const target = laneAtY(layout, clientY - top);
					if (target && target !== item.laneId) {
						laneId = target as Doc<"lanes">["_id"];
					}
				}
				onItemDatesChange(item._id, next.startDate, next.endDate, laneId);
			}
		: undefined;

	return (
		<div className="overflow-auto rounded-lg border border-neutral-200 bg-white">
			<div style={{ width: LABEL_WIDTH + axisWidth }}>
				<TimeAxis periods={periods} columnWidth={colW} labelWidth={LABEL_WIDTH} />
				<div className="relative" ref={lanesRef}>
					{lanes.map((lane) => {
						const laneItems = items.filter((i) => i.laneId === lane._id);
						const rows = packLanes(laneItems);
						const geometries = laneItems.map((it) =>
							itemGeometry(it, windowStart, windowEnd, axisWidth),
						);
						const colors = laneItems.map((it) =>
							barColor(it, fields, roadmap.colorByFieldKey),
						);
						return (
							<LaneRow
								key={lane._id}
								lane={lane}
								items={laneItems}
								rows={rows}
								geometries={geometries}
								colors={colors}
								colorMode={colorMode}
								rowHeight={ROW_HEIGHT}
								rowGap={ROW_GAP}
								labelWidth={LABEL_WIDTH}
								axisWidth={axisWidth}
								unitWidth={colW}
								onSelect={onSelectItem}
								onItemDrag={handleItemDrag}
								onItemDragMove={handleItemDragMove}
								previewGeometryFor={previewGeometryFor}
								onAddItem={onAddItem ? (laneId) => onAddItem(laneId) : undefined}
								onAddItemAt={
									onAddItem
										? (laneId, localX) =>
												onAddItem(
													laneId,
													xToDate(localX, windowStart, windowEnd, axisWidth),
												)
										: undefined
								}
							/>
						);
					})}
					{onAddLane ? (
						<AddLaneRow labelWidth={LABEL_WIDTH} onAdd={onAddLane} />
					) : null}
					<div
						className="pointer-events-none absolute top-0"
						style={{ left: LABEL_WIDTH, width: axisWidth, height: totalHeight }}
					>
						{guideX !== null ? (
							<div
								className="absolute top-0 w-px bg-blue-500"
								style={{ left: guideX, height: totalHeight }}
							/>
						) : null}
						{milestones.map((m) => (
							<MilestoneMarker
								key={m._id}
								milestone={m}
								x={dateToX(m.date, windowStart, windowEnd, axisWidth)}
								height={totalHeight}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
```

> Note: `COLUMN_WIDTH` is no longer exported (it was only used inside `TimelineView`). The grep in the design confirmed no other importers.

- [ ] **Step 3: Create the `AddLaneRow` component**

Create `src/components/timeline/AddLaneRow.tsx`:

```tsx
import { Plus } from "lucide-react";
import { useState } from "react";

export function AddLaneRow({
	labelWidth,
	onAdd,
}: {
	labelWidth: number;
	onAdd: (name: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState("");

	function commit() {
		const trimmed = name.trim();
		if (trimmed) onAdd(trimmed);
		setName("");
		setEditing(false);
	}

	return (
		<div className="flex border-b border-neutral-200">
			<div
				style={{ width: labelWidth }}
				className="shrink-0 border-r border-neutral-200 bg-white p-2"
			>
				{editing ? (
					<input
						// biome-ignore lint/a11y/noAutofocus: focus the field the user just opened
						autoFocus
						value={name}
						onChange={(e) => setName(e.target.value)}
						onBlur={commit}
						onKeyDown={(e) => {
							if (e.key === "Enter") commit();
							if (e.key === "Escape") {
								setName("");
								setEditing(false);
							}
						}}
						placeholder="Lane name"
						className="w-full rounded border border-neutral-200 px-1.5 py-1 text-[13px]"
					/>
				) : (
					<button
						type="button"
						onClick={() => setEditing(true)}
						className="flex items-center gap-1 text-[13px] text-neutral-500 hover:text-neutral-900"
					>
						<Plus size={14} /> Add lane
					</button>
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `npx tsc --noEmit && npm run check && npm run build`
Expected: no errors. (The editor route still passes the old props; it is updated in Task 9. The new `TimelineView` props are optional, so the build stays green.)

- [ ] **Step 5: Commit (bundle with Task 6 if you held that commit)**

```bash
git add src/components/timeline/TimelineView.tsx src/components/timeline/LaneRow.tsx src/components/timeline/AddLaneRow.tsx src/components/timeline/ItemBar.tsx
git commit -m "feat: zoom-aware columns, snap guide overlay, inline-add plumbing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Milestone name on hover/click popover (`MilestoneMarker`)

**Files:**
- Modify: `src/components/timeline/MilestoneMarker.tsx`

- [ ] **Step 1: Replace `MilestoneMarker.tsx`**

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import { Popover } from "radix-ui";
import { useState } from "react";
import { msToDateInput } from "@/lib/fields";

export function MilestoneMarker({
	milestone,
	x,
	height,
}: {
	milestone: Doc<"milestones">;
	x: number;
	height: number;
}) {
	const [hovered, setHovered] = useState(false);
	const [pinned, setPinned] = useState(false);
	const color = milestone.color ?? "#404040";

	return (
		<div
			style={{ left: x, height }}
			className="pointer-events-none absolute top-0 z-20"
		>
			<div
				style={{ backgroundColor: color, height }}
				className="absolute top-0 w-px"
			/>
			<Popover.Root
				open={hovered || pinned}
				onOpenChange={(o) => {
					if (!o) {
						setPinned(false);
						setHovered(false);
					}
				}}
			>
				<Popover.Trigger asChild>
					<button
						type="button"
						aria-label={milestone.name}
						onPointerEnter={() => setHovered(true)}
						onPointerLeave={() => setHovered(false)}
						onClick={() => setPinned((p) => !p)}
						style={{ backgroundColor: color }}
						className="pointer-events-auto absolute -left-1 -top-0.5 size-2 rounded-full"
					/>
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content
						sideOffset={6}
						className="z-50 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs shadow-md"
					>
						<p className="font-medium">{milestone.name}</p>
						<p className="font-mono text-[11px] text-neutral-500">
							{msToDateInput(milestone.date)}
						</p>
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		</div>
	);
}
```

Behavior: hover the dot → popover shows; move away → it hides; click the dot → pinned (stays after the pointer leaves); click again, click outside, or press Escape → dismisses. The marker itself stays a thin line + dot, so adjacent milestones never overlap as text.

- [ ] **Step 2: Typecheck, lint, build**

Run: `npx tsc --noEmit && npm run check && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/MilestoneMarker.tsx
git commit -m "feat: milestone name in hover/click-to-pin popover

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Bar color style control + editor wiring + header restructure

**Files:**
- Modify: `src/components/roadmaps/RoadmapSettingsDialog.tsx`
- Modify: `src/components/panel/ItemEditorPanel.tsx`
- Modify: `src/routes/roadmaps/$id.tsx`

- [ ] **Step 1: Add the "Bar color style" control to settings**

In `src/components/roadmaps/RoadmapSettingsDialog.tsx`, add this block immediately after the closing `</label>` of the "Color items by" select (before `</Dialog.Content>`):

```tsx
						<label className="block text-sm">
							Bar color style
							<select
								className={base}
								defaultValue={roadmap.barColorMode ?? "left"}
								onChange={(e) =>
									update({
										roadmapId: roadmap._id,
										barColorMode: e.target.value as "left" | "fill",
									})
								}
							>
								<option value="left">Left line</option>
								<option value="fill">Fill bar</option>
							</select>
						</label>
```

- [ ] **Step 2: Add preset support to `ItemEditorPanel`**

In `src/components/panel/ItemEditorPanel.tsx`, change `draftFromItem` to accept presets:

```tsx
function draftFromItem(
	item: Doc<"items"> | null,
	fields: Doc<"fields">[],
	defaultLaneId: Id<"lanes">,
	windowStart: number,
	presetLaneId?: Id<"lanes">,
	presetStartMs?: number,
): ItemDraft {
	if (item) {
		return {
			title: item.title,
			laneId: item.laneId,
			startMs: item.startDate,
			endMs: item.endDate,
			description: item.description ?? "",
			values: { ...item.values },
		};
	}
	const values: Record<string, FieldValue> = {};
	for (const f of fields) values[f.key] = emptyValue(f);
	const day = 24 * 60 * 60 * 1000;
	const startMs = presetStartMs ?? windowStart;
	return {
		title: "",
		laneId: presetLaneId ?? defaultLaneId,
		startMs,
		endMs: startMs + 30 * day,
		description: "",
		values,
	};
}
```

Add the two props to the component signature (after `windowStart`):

```tsx
	windowStart,
	presetLaneId,
	presetStartMs,
	onClose,
}: {
	roadmapId: Id<"roadmaps">;
	item: Doc<"items"> | null;
	fields: Doc<"fields">[];
	lanes: Doc<"lanes">[];
	windowStart: number;
	presetLaneId?: Id<"lanes">;
	presetStartMs?: number;
	onClose: () => void;
}) {
```

Update the initial state and the reset effect to pass the presets:

```tsx
	const [draft, setDraft] = useState<ItemDraft>(() =>
		draftFromItem(item, fields, lanes[0]._id, windowStart, presetLaneId, presetStartMs),
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setDraft(
			draftFromItem(item, fields, lanes[0]._id, windowStart, presetLaneId, presetStartMs),
		);
		setError(null);
	}, [item, fields, lanes, windowStart, presetLaneId, presetStartMs]);
```

- [ ] **Step 3: Restructure the editor header and wire inline-add in `$id.tsx`**

In `src/routes/roadmaps/$id.tsx`:

Add a lane-create mutation near the other hooks (after `const updateItem = useMutation(api.items.update);`):

```tsx
	const updateItem = useMutation(api.items.update);
	const createLane = useMutation(api.lanes.create);
```

Replace the `editing` state with edit + new-item states:

```tsx
	const [editing, setEditing] = useState<Id<"items"> | null>(null);
	const [newItem, setNewItem] = useState<
		null | { laneId?: Id<"lanes">; startMs?: number }
	>(null);
```

Replace the derived `editingItem` line:

```tsx
	const editingItem = editing
		? (bundle.items.find((i) => i._id === editing) ?? null)
		: null;
	const panelOpen = editing !== null || newItem !== null;
```

Replace the header element (`<header ...> ... </header>`) with a stable two-row layout:

```tsx
				<header className="mb-4 space-y-3">
					<div>
						<p className="rm-label">Roadmap</p>
						<h1 className="text-2xl font-semibold">{bundle.roadmap.name}</h1>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<div className="inline-flex overflow-hidden rounded-md border border-neutral-200">
							{(["timeline", "table"] as const).map((v) => (
								<button
									key={v}
									type="button"
									onClick={() => setView(v)}
									className={`border-r border-neutral-200 px-3 py-1.5 text-xs capitalize last:border-r-0 ${
										v === view
											? "bg-neutral-100 text-neutral-900"
											: "text-neutral-500"
									}`}
								>
									{v}
								</button>
							))}
						</div>
						{view === "timeline" ? (
							<ZoomSwitch value={activeZoom} onChange={setZoom} />
						) : null}
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setLanesOpen(true)}
						>
							Lanes
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setFieldsOpen(true)}
						>
							Fields
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setMilestonesOpen(true)}
						>
							Milestones
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setSettingsOpen(true)}
						>
							Settings
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setShareOpen(true)}
						>
							Share
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setIoOpen(true)}
						>
							Edit JSON data
						</button>
						<button
							type="button"
							className={toolbarBtn}
							onClick={() => setVersionsOpen(true)}
						>
							Versions
						</button>
						<button
							type="button"
							onClick={() => setNewItem({})}
							className="rm-btn-primary"
						>
							New item
						</button>
					</div>
				</header>
```

Wire the new `TimelineView` props (replace the `<TimelineView .../>` usage):

```tsx
					<TimelineView
						bundle={visibleBundle}
						zoom={activeZoom}
						onSelectItem={(itemId) => setEditing(itemId)}
						onItemDatesChange={(itemId, startDate, endDate, laneId) =>
							updateItem({ itemId, startDate, endDate, laneId })
						}
						onAddItem={(laneId, startMs) => setNewItem({ laneId, startMs })}
						onAddLane={(name) => createLane({ roadmapId, name })}
					/>
```

Replace the panel render block (the `{editing !== null ? (...) : null}` section):

```tsx
				{panelOpen ? (
					<ItemEditorPanel
						roadmapId={roadmapId}
						item={editingItem}
						fields={bundle.fields}
						lanes={bundle.lanes}
						windowStart={bundle.roadmap.startDate}
						presetLaneId={newItem?.laneId}
						presetStartMs={newItem?.startMs}
						onClose={() => {
							setEditing(null);
							setNewItem(null);
						}}
					/>
				) : null}
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `npx tsc --noEmit && npm run check && npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/roadmaps/RoadmapSettingsDialog.tsx src/components/panel/ItemEditorPanel.tsx src/routes/roadmaps/$id.tsx
git commit -m "feat: bar color style setting, inline add items/lanes, stable header

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Full manual verification

**Files:** none (verification only)

The share view (`src/components/share/ReadOnlyRoadmap.tsx`) needs **no code change**: it reuses `TimelineView`, so it inherits the narrower zoom-aware columns automatically, and `ItemBar`'s read-only `cursor-default` removes the misleading grab hand. Confirm it.

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test && npm run check && npx tsc --noEmit && npm run build`
Expected: all green.

- [ ] **Step 2: Start the app**

Run (two terminals): `npx convex dev` and `npm run dev`. Open a roadmap.

- [ ] **Step 3: Verify each item by hand**

- [ ] Snapping: drag/resize a bar — it moves in snapped steps (day at week zoom, week at month zoom, month at quarter/half), a blue guide line tracks the moving edge, and the bar lands where the preview showed.
- [ ] Year band: the sticky top row shows the year(s); the year-boundary column divider is heavier; `half` columns read `H1`/`H2`.
- [ ] Header: switch timeline ↔ table — the controls row stays put and does not reflow.
- [ ] Inline add: hover a lane label → `+` appears and opens the New item panel preset to that lane; double-click empty canvas → panel opens with that lane and the clicked date; `+ Add lane` row adds and inline-renames a lane.
- [ ] Bar fill: Settings → Bar color style → Fill — bars paint fully with legible text; switch back to Left line restores the accent border.
- [ ] Milestones: hover a dot → name + date popover; click → it pins and stays; click again / outside / Escape → dismisses.
- [ ] Share view: open the share link — no grab cursor on bars, columns are narrower, horizontal scroll only for long ranges.

- [ ] **Step 4: Final commit (if any manual-fix tweaks were needed)**

```bash
git add -A
git commit -m "chore: timeline UX polish manual-verification fixes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** (1) snapping → Tasks 1, 6, 7; (2) year band → Tasks 1, 5; (3) header → Task 9; (4) inline add → Tasks 7, 9; (5) bar fill → Tasks 2, 3, 4, 6, 7, 9; (6) milestone names → Task 8; (7) share view → Tasks 1, 6, 10.
- **Type consistency:** `barColorMode` is `"left" | "fill"` everywhere; `colorMode` prop is required on `ItemBar`/`LaneRow` and supplied by `TimelineView` as `roadmap.barColorMode ?? "left"`; `snapDate`'s third domain value `SnapUnit` is `"day" | "week" | "month"` (no longer the full `Zoom`); `resolveDrag`'s signature is unchanged (still takes `zoom`).
- **Watch-outs:** after any `convex/` edit, run `npx convex dev --once` so `Doc<"roadmaps">` includes `barColorMode` before the frontend typechecks; commit the regenerated `convex/_generated`.

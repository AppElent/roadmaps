# Roadmaps Phase 3 — Timeline Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tested, framework-free timeline math module, and a read-only timeline view that renders lanes, item bars, milestones, and a zoom switch from the real-time `getBundle`.

**Architecture:** `src/lib/timeline.ts` holds all date↔pixel math as pure functions (Vitest-covered). The view derives `axisWidth = periods.length × COLUMN_WIDTH` and maps the window `[periods[0].start, lastPeriod.end]` onto it, so bars align to gridlines. `packLanes` stacks time-overlapping items into sub-rows.

**Tech Stack:** date-fns, React, Convex `useQuery`, TanStack Router.

**Depends on:** Phases 0–2.

---

## File structure for this phase

- Create: `src/lib/timeline.ts` — pure math
- Create: `src/lib/__tests__/timeline.test.ts`
- Create: `src/components/timeline/TimeAxis.tsx`
- Create: `src/components/timeline/ItemBar.tsx` (read-only this phase)
- Create: `src/components/timeline/MilestoneMarker.tsx`
- Create: `src/components/timeline/LaneRow.tsx`
- Create: `src/components/timeline/TimelineView.tsx`
- Create: `src/components/timeline/ZoomSwitch.tsx`
- Create: `src/lib/roadmapColors.ts` — derive a bar color from the color-by field
- Create: `src/routes/roadmaps/$id.tsx`

---

### Task 1: Timeline math — `buildPeriods` (TDD)

**Files:**
- Create: `src/lib/timeline.ts`
- Create: `src/lib/__tests__/timeline.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/timeline.test.ts`. (Tests build local-time dates; the module uses date-fns, which is also local-time, so they stay consistent.)

```ts
import { expect, test } from "vitest";
import {
	buildPeriods,
	dateToX,
	itemGeometry,
	packLanes,
	snapDate,
	xToDate,
} from "../timeline";

const ms = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

test("buildPeriods: months across H1 2026", () => {
	const periods = buildPeriods(ms(2026, 0, 1), ms(2026, 5, 30), "month");
	expect(periods).toHaveLength(6);
	expect(periods[0].label).toBe("Jan");
	expect(periods[5].label).toBe("Jun");
	expect(periods[0].start).toBe(ms(2026, 0, 1));
});

test("buildPeriods: quarters across 2026", () => {
	const periods = buildPeriods(ms(2026, 0, 1), ms(2026, 11, 31), "quarter");
	expect(periods.map((p) => p.label)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
});

test("buildPeriods: halves across 2026-2027", () => {
	const periods = buildPeriods(ms(2026, 0, 1), ms(2027, 11, 31), "half");
	expect(periods.map((p) => p.label)).toEqual([
		"H1 2026",
		"H2 2026",
		"H1 2027",
		"H2 2027",
	]);
});

test("buildPeriods: weeks produce W-prefixed labels", () => {
	const periods = buildPeriods(ms(2026, 0, 1), ms(2026, 0, 28), "week");
	expect(periods.length).toBeGreaterThanOrEqual(4);
	expect(periods[0].label.startsWith("W")).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: FAIL — cannot find `../timeline`.

- [ ] **Step 3: Implement the period builder (and stubs for later steps)**

Create `src/lib/timeline.ts`:

```ts
import {
	eachMonthOfInterval,
	eachQuarterOfInterval,
	eachWeekOfInterval,
	endOfMonth,
	endOfQuarter,
	endOfWeek,
	format,
	getISOWeek,
	getQuarter,
	startOfMonth,
	startOfQuarter,
	startOfWeek,
} from "date-fns";

export type Zoom = "week" | "month" | "quarter" | "half";

export interface Period {
	start: number;
	end: number;
	label: string;
}

const WEEK_OPTS = { weekStartsOn: 1 as const };

function startOfHalf(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1);
}

function endOfHalf(d: Date): Date {
	return endOfMonth(new Date(d.getFullYear(), d.getMonth() < 6 ? 5 : 11, 1));
}

export function buildPeriods(
	windowStart: number,
	windowEnd: number,
	zoom: Zoom,
): Period[] {
	const start = new Date(windowStart);
	const end = new Date(windowEnd);

	if (zoom === "month") {
		return eachMonthOfInterval({ start, end }).map((d) => ({
			start: startOfMonth(d).getTime(),
			end: endOfMonth(d).getTime(),
			label: format(d, "MMM"),
		}));
	}
	if (zoom === "quarter") {
		return eachQuarterOfInterval({ start, end }).map((d) => ({
			start: startOfQuarter(d).getTime(),
			end: endOfQuarter(d).getTime(),
			label: `Q${getQuarter(d)}`,
		}));
	}
	if (zoom === "week") {
		return eachWeekOfInterval({ start, end }, WEEK_OPTS).map((d) => ({
			start: startOfWeek(d, WEEK_OPTS).getTime(),
			end: endOfWeek(d, WEEK_OPTS).getTime(),
			label: `W${getISOWeek(d)}`,
		}));
	}
	// half
	const periods: Period[] = [];
	let cursor = startOfHalf(start);
	while (cursor.getTime() <= windowEnd) {
		const s = startOfHalf(cursor);
		const e = endOfHalf(cursor);
		periods.push({
			start: s.getTime(),
			end: e.getTime(),
			label: `${s.getMonth() < 6 ? "H1" : "H2"} ${s.getFullYear()}`,
		});
		cursor = new Date(e.getTime() + 1);
	}
	return periods;
}

export function dateToX(
	date: number,
	windowStart: number,
	windowEnd: number,
	axisWidth: number,
): number {
	const span = windowEnd - windowStart || 1;
	return ((date - windowStart) / span) * axisWidth;
}

export function xToDate(
	x: number,
	windowStart: number,
	windowEnd: number,
	axisWidth: number,
): number {
	const span = windowEnd - windowStart || 1;
	return Math.round(windowStart + (x / (axisWidth || 1)) * span);
}

export function itemGeometry(
	item: { startDate: number; endDate: number },
	windowStart: number,
	windowEnd: number,
	axisWidth: number,
): { left: number; width: number } {
	const rawLeft = dateToX(item.startDate, windowStart, windowEnd, axisWidth);
	const rawRight = dateToX(item.endDate, windowStart, windowEnd, axisWidth);
	const left = Math.max(0, Math.min(axisWidth, rawLeft));
	const right = Math.max(0, Math.min(axisWidth, rawRight));
	return { left, width: Math.max(8, right - left) };
}

export function snapDate(
	date: number,
	zoom: Zoom,
	edge: "start" | "end",
): number {
	const d = new Date(date);
	if (zoom === "month") {
		return (edge === "start" ? startOfMonth(d) : endOfMonth(d)).getTime();
	}
	if (zoom === "quarter") {
		return (edge === "start" ? startOfQuarter(d) : endOfQuarter(d)).getTime();
	}
	if (zoom === "week") {
		return (
			edge === "start" ? startOfWeek(d, WEEK_OPTS) : endOfWeek(d, WEEK_OPTS)
		).getTime();
	}
	return (edge === "start" ? startOfHalf(d) : endOfHalf(d)).getTime();
}

/** First-fit packing. Returns the sub-row index for each item, in input order. */
export function packLanes(
	items: Array<{ startDate: number; endDate: number }>,
): number[] {
	const indexed = items.map((it, i) => ({ ...it, i }));
	indexed.sort((a, b) => a.startDate - b.startDate);
	const rowEnds: number[] = [];
	const result = new Array<number>(items.length).fill(0);
	for (const it of indexed) {
		let row = rowEnds.findIndex((end) => end <= it.startDate);
		if (row === -1) {
			row = rowEnds.length;
			rowEnds.push(it.endDate);
		} else {
			rowEnds[row] = it.endDate;
		}
		result[it.i] = row;
	}
	return result;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: PASS — the 4 `buildPeriods` tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/__tests__/timeline.test.ts
git commit -m "feat: timeline period builder"
```

---

### Task 2: Timeline math — positioning, snapping, packing (TDD)

**Files:**
- Modify: `src/lib/__tests__/timeline.test.ts`

- [ ] **Step 1: Add tests for the remaining functions**

Append to `src/lib/__tests__/timeline.test.ts`:

```ts
test("dateToX/xToDate round-trip", () => {
	const ws = ms(2026, 0, 1);
	const we = ms(2026, 11, 31);
	const x = dateToX(ms(2026, 5, 1), ws, we, 1200);
	expect(xToDate(x, ws, we, 1200)).toBe(ms(2026, 5, 1));
});

test("itemGeometry clamps to the axis and enforces a min width", () => {
	const ws = ms(2026, 0, 1);
	const we = ms(2026, 1, 1);
	const g = itemGeometry(
		{ startDate: ms(2025, 0, 1), endDate: ms(2026, 0, 1) },
		ws,
		we,
		1000,
	);
	expect(g.left).toBe(0);
	expect(g.width).toBeGreaterThanOrEqual(8);
});

test("snapDate snaps to month edges", () => {
	const mid = ms(2026, 2, 14);
	expect(snapDate(mid, "month", "start")).toBe(ms(2026, 2, 1));
	expect(new Date(snapDate(mid, "month", "end")).getMonth()).toBe(2);
});

test("packLanes stacks overlapping items, shares rows for disjoint ones", () => {
	const overlap = packLanes([
		{ startDate: 0, endDate: 10 },
		{ startDate: 5, endDate: 15 },
	]);
	expect(overlap).toEqual([0, 1]);
	const disjoint = packLanes([
		{ startDate: 0, endDate: 10 },
		{ startDate: 10, endDate: 20 },
	]);
	expect(disjoint).toEqual([0, 0]);
});
```

- [ ] **Step 2: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/timeline.test.ts`
Expected: PASS — all 8 tests (functions already implemented in Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/timeline.test.ts
git commit -m "test: cover timeline positioning, snapping, packing"
```

---

### Task 3: Bar color helper

**Files:**
- Create: `src/lib/roadmapColors.ts`

- [ ] **Step 1: Implement**

```ts
import type { Doc } from "@convex/_generated/dataModel";

const FALLBACK = "#e5e5e5";

/** Resolves an item's bar color from the roadmap's color-by select field. */
export function barColor(
	item: Doc<"items">,
	fields: Doc<"fields">[],
	colorByFieldKey: string | undefined,
): string {
	if (!colorByFieldKey) return FALLBACK;
	const field = fields.find((f) => f.key === colorByFieldKey);
	if (!field || !field.options) return FALLBACK;
	const value = item.values[colorByFieldKey];
	const optionId = Array.isArray(value) ? value[0] : value;
	const option = field.options.find((o) => o.id === optionId);
	return option?.color ?? FALLBACK;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/roadmapColors.ts
git commit -m "feat: resolve item bar color from color-by field"
```

---

### Task 4: Presentational timeline components

**Files:**
- Create: `src/components/timeline/TimeAxis.tsx`
- Create: `src/components/timeline/ItemBar.tsx`
- Create: `src/components/timeline/MilestoneMarker.tsx`
- Create: `src/components/timeline/LaneRow.tsx`

These are layout constants shared across the components; define them in `TimelineView` (Task 5) and pass down, or duplicate the constant. To keep one source of truth, export them from `TimelineView`.

- [ ] **Step 1: `TimeAxis.tsx`**

```tsx
import type { Period } from "@/lib/timeline";

export function TimeAxis({
	periods,
	columnWidth,
	labelWidth,
}: {
	periods: Period[];
	columnWidth: number;
	labelWidth: number;
}) {
	return (
		<div className="sticky top-0 z-10 flex border-b border-neutral-200 bg-neutral-50">
			<div
				style={{ width: labelWidth }}
				className="shrink-0 border-r border-neutral-200"
			/>
			{periods.map((p) => (
				<div
					key={p.start}
					style={{ width: columnWidth }}
					className="shrink-0 border-r border-neutral-200 px-2 py-2 font-mono text-[11px] uppercase tracking-wide text-neutral-500"
				>
					{p.label}
				</div>
			))}
		</div>
	);
}
```

- [ ] **Step 2: `ItemBar.tsx` (read-only)**

```tsx
import type { Doc } from "@convex/_generated/dataModel";

export function ItemBar({
	item,
	left,
	width,
	top,
	color,
	onSelect,
}: {
	item: Doc<"items">;
	left: number;
	width: number;
	top: number;
	color: string;
	onSelect?: (id: Doc<"items">["_id"]) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect?.(item._id)}
			style={{ left, width, top, borderLeftColor: color }}
			className="absolute h-9 overflow-hidden rounded-md border border-l-4 border-neutral-200 bg-white px-2 text-left text-xs shadow-sm hover:border-neutral-400"
		>
			<span className="block truncate font-medium leading-9">{item.title}</span>
		</button>
	);
}
```

- [ ] **Step 3: `MilestoneMarker.tsx`**

```tsx
import type { Doc } from "@convex/_generated/dataModel";

export function MilestoneMarker({
	milestone,
	x,
	height,
}: {
	milestone: Doc<"milestones">;
	x: number;
	height: number;
}) {
	return (
		<div
			style={{ left: x, height }}
			className="pointer-events-none absolute top-0 z-20 w-px bg-neutral-400"
			title={milestone.name}
		>
			<span
				style={{ backgroundColor: milestone.color ?? "#404040" }}
				className="absolute -left-1 -top-0.5 size-2 rounded-full"
			/>
		</div>
	);
}
```

- [ ] **Step 4: `LaneRow.tsx`**

```tsx
import type { Doc } from "@convex/_generated/dataModel";
import { ItemBar } from "./ItemBar";

export function LaneRow({
	lane,
	items,
	rows,
	geometries,
	colors,
	rowHeight,
	rowGap,
	labelWidth,
	axisWidth,
	onSelect,
}: {
	lane: Doc<"lanes">;
	items: Doc<"items">[];
	rows: number[];
	geometries: Array<{ left: number; width: number }>;
	colors: string[];
	rowHeight: number;
	rowGap: number;
	labelWidth: number;
	axisWidth: number;
	onSelect?: (id: Doc<"items">["_id"]) => void;
}) {
	const depth = items.length ? Math.max(...rows) + 1 : 1;
	const height = depth * (rowHeight + rowGap) + rowGap;
	return (
		<div className="flex border-b border-neutral-200" style={{ height }}>
			<div
				style={{ width: labelWidth }}
				className="shrink-0 border-r border-neutral-200 bg-white p-2"
			>
				<strong className="text-[13px]">{lane.name}</strong>
				<span className="block font-mono text-[11px] text-neutral-500">
					{items.length} items
				</span>
			</div>
			<div className="relative" style={{ width: axisWidth }}>
				{items.map((item, i) => (
					<ItemBar
						key={item._id}
						item={item}
						left={geometries[i].left}
						width={geometries[i].width}
						top={rows[i] * (rowHeight + rowGap) + rowGap}
						color={colors[i]}
						onSelect={onSelect}
					/>
				))}
			</div>
		</div>
	);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/timeline/TimeAxis.tsx src/components/timeline/ItemBar.tsx src/components/timeline/MilestoneMarker.tsx src/components/timeline/LaneRow.tsx
git commit -m "feat: presentational timeline components"
```

---

### Task 5: TimelineView orchestrator + ZoomSwitch

**Files:**
- Create: `src/components/timeline/ZoomSwitch.tsx`
- Create: `src/components/timeline/TimelineView.tsx`

- [ ] **Step 1: `ZoomSwitch.tsx`**

```tsx
import type { Zoom } from "@/lib/timeline";

const ZOOMS: Zoom[] = ["week", "month", "quarter", "half"];

export function ZoomSwitch({
	value,
	onChange,
}: {
	value: Zoom;
	onChange: (z: Zoom) => void;
}) {
	return (
		<div className="inline-flex overflow-hidden rounded-md border border-neutral-200">
			{ZOOMS.map((z) => (
				<button
					key={z}
					type="button"
					onClick={() => onChange(z)}
					className={`border-r border-neutral-200 px-3 py-1.5 text-xs capitalize last:border-r-0 ${
						z === value ? "bg-neutral-100 text-neutral-900" : "text-neutral-500"
					}`}
				>
					{z}
				</button>
			))}
		</div>
	);
}
```

- [ ] **Step 2: `TimelineView.tsx`**

```tsx
import { useMemo } from "react";
import type { Doc } from "@convex/_generated/dataModel";
import { barColor } from "@/lib/roadmapColors";
import {
	buildPeriods,
	dateToX,
	itemGeometry,
	packLanes,
	type Zoom,
} from "@/lib/timeline";
import { LaneRow } from "./LaneRow";
import { MilestoneMarker } from "./MilestoneMarker";
import { TimeAxis } from "./TimeAxis";

export const COLUMN_WIDTH = 140;
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
}: {
	bundle: TimelineBundle;
	zoom: Zoom;
	onSelectItem?: (id: Doc<"items">["_id"]) => void;
}) {
	const { roadmap, fields, lanes, items, milestones } = bundle;

	const periods = useMemo(
		() => buildPeriods(roadmap.startDate, roadmap.endDate, zoom),
		[roadmap.startDate, roadmap.endDate, zoom],
	);
	const axisWidth = periods.length * COLUMN_WIDTH;
	const windowStart = periods[0]?.start ?? roadmap.startDate;
	const windowEnd = periods[periods.length - 1]?.end ?? roadmap.endDate;

	const totalHeight = lanes.reduce((sum, lane) => {
		const laneItems = items.filter((i) => i.laneId === lane._id);
		const depth = laneItems.length
			? Math.max(...packLanes(laneItems)) + 1
			: 1;
		return sum + depth * (ROW_HEIGHT + ROW_GAP) + ROW_GAP;
	}, 0);

	return (
		<div className="overflow-auto rounded-lg border border-neutral-200 bg-white">
			<div style={{ width: LABEL_WIDTH + axisWidth }}>
				<TimeAxis
					periods={periods}
					columnWidth={COLUMN_WIDTH}
					labelWidth={LABEL_WIDTH}
				/>
				<div className="relative">
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
								rowHeight={ROW_HEIGHT}
								rowGap={ROW_GAP}
								labelWidth={LABEL_WIDTH}
								axisWidth={axisWidth}
								onSelect={onSelectItem}
							/>
						);
					})}
					<div
						className="pointer-events-none absolute top-0"
						style={{ left: LABEL_WIDTH, width: axisWidth, height: totalHeight }}
					>
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

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/ZoomSwitch.tsx src/components/timeline/TimelineView.tsx
git commit -m "feat: timeline view orchestrator and zoom switch"
```

---

### Task 6: Roadmap editor route (read-only timeline)

**Files:**
- Create: `src/routes/roadmaps/$id.tsx`

- [ ] **Step 1: Implement the route**

```tsx
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { TimelineView } from "@/components/timeline/TimelineView";
import { ZoomSwitch } from "@/components/timeline/ZoomSwitch";
import type { Zoom } from "@/lib/timeline";

export const Route = createFileRoute("/roadmaps/$id")({
	ssr: false,
	component: RoadmapEditor,
});

function RoadmapEditor() {
	const { id } = Route.useParams();
	const bundle = useQuery(api.roadmaps.getBundle, {
		roadmapId: id as Id<"roadmaps">,
	});
	const [zoom, setZoom] = useState<Zoom | null>(null);

	if (bundle === undefined) {
		return (
			<AppShell>
				<p className="p-6 text-sm text-neutral-500">Loading…</p>
			</AppShell>
		);
	}

	const activeZoom: Zoom = zoom ?? bundle.roadmap.defaultZoom;

	return (
		<AppShell>
			<div className="p-6">
				<header className="mb-4 flex items-center justify-between">
					<div>
						<p className="font-mono text-xs uppercase tracking-wide text-neutral-500">
							Roadmap
						</p>
						<h1 className="text-2xl font-semibold">{bundle.roadmap.name}</h1>
					</div>
					<ZoomSwitch value={activeZoom} onChange={setZoom} />
				</header>
				<TimelineView bundle={bundle} zoom={activeZoom} />
			</div>
		</AppShell>
	);
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev:all`. Open a roadmap from the dashboard. Expected: lanes render with the default lane; the time axis matches the roadmap's window; switching zoom re-buckets the axis. Add a couple of items via the Convex dashboard (or wait for Phase 4) to see bars; milestones added directly show as markers.

- [ ] **Step 3: Lint + commit**

```bash
npm run check
git add src/routes/roadmaps/$id.tsx
git commit -m "feat: read-only roadmap timeline route"
```

---

## Self-review notes

- **Spec coverage:** `src/lib/timeline.ts` with `buildPeriods`/`dateToX`/`xToDate`/`snapDate`/`packLanes` (§6) ✓; read-only timeline with axis, lanes, bars, milestones, zoom (§6) ✓; bar color from color-by field (§7) ✓.
- **Type consistency:** `TimelineBundle` matches `getBundle`'s return shape (roadmap + fields + lanes + items + milestones). Layout constants (`COLUMN_WIDTH`, `LABEL_WIDTH`, `ROW_HEIGHT`, `ROW_GAP`) are exported from `TimelineView` and reused in Phase 5's drag math.
- **Deferred:** creating/editing items via the panel is Phase 4; drag/resize is Phase 5. This phase renders existing data read-only.

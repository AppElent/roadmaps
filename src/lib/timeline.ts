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
			label: s.getMonth() < 6 ? "H1" : "H2",
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

export interface LaneBound {
	laneId: string;
	top: number;
	bottom: number;
}

/**
 * Cumulative vertical bounds (top/bottom px) for each lane, in lane order.
 * Mirrors the height math in `LaneRow`: a lane is as tall as its deepest
 * `packLanes` row, with a minimum of one row.
 */
export function laneLayout(
	lanes: Array<{ _id: string }>,
	items: Array<{ laneId: string; startDate: number; endDate: number }>,
	rowHeight: number,
	rowGap: number,
): LaneBound[] {
	const bounds: LaneBound[] = [];
	let top = 0;
	for (const lane of lanes) {
		const laneItems = items.filter((i) => i.laneId === lane._id);
		const depth = laneItems.length ? Math.max(...packLanes(laneItems)) + 1 : 1;
		const height = depth * (rowHeight + rowGap) + rowGap;
		bounds.push({ laneId: lane._id, top, bottom: top + height });
		top += height;
	}
	return bounds;
}

/** Returns the laneId whose vertical band contains `y`, or null if outside all lanes. */
export function laneAtY(layout: LaneBound[], y: number): string | null {
	for (const bound of layout) {
		if (y >= bound.top && y < bound.bottom) return bound.laneId;
	}
	return null;
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

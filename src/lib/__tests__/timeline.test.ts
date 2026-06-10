import { expect, test } from "vitest";
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
	expect(periods.map((p) => p.label)).toEqual(["H1", "H2", "H1", "H2"]);
});

test("buildPeriods: weeks produce W-prefixed labels", () => {
	const periods = buildPeriods(ms(2026, 0, 1), ms(2026, 0, 28), "week");
	expect(periods.length).toBeGreaterThanOrEqual(4);
	expect(periods[0].label.startsWith("W")).toBe(true);
});

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

test("snapDate snaps to the given unit edges", () => {
	const mid = ms(2026, 2, 14);
	expect(snapDate(mid, "month", "start")).toBe(ms(2026, 2, 1));
	expect(new Date(snapDate(mid, "month", "end")).getMonth()).toBe(2);
	// day unit snaps to start/end of that calendar day
	expect(snapDate(mid, "day", "start")).toBe(ms(2026, 2, 14));
	// week unit (Mon-start) lands on a Monday
	expect(new Date(snapDate(mid, "week", "start")).getDay()).toBe(1);
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

test("laneLayout stacks lanes cumulatively, sizing by deepest packed row", () => {
	const lanes = [{ _id: "a" }, { _id: "b" }, { _id: "c" }];
	const items = [
		// lane a: two overlapping items -> depth 2
		{ laneId: "a", startDate: 0, endDate: 10 },
		{ laneId: "a", startDate: 5, endDate: 15 },
		// lane b: one item -> depth 1
		{ laneId: "b", startDate: 0, endDate: 10 },
		// lane c: empty -> depth 1
	];
	const layout = laneLayout(lanes, items, 36, 8);
	// row unit = 36 + 8 = 44, gap = 8
	expect(layout).toEqual([
		{ laneId: "a", top: 0, bottom: 2 * 44 + 8 },
		{ laneId: "b", top: 96, bottom: 96 + (44 + 8) },
		{ laneId: "c", top: 148, bottom: 148 + (44 + 8) },
	]);
});

test("laneAtY maps a y coordinate to the containing lane, null when outside", () => {
	const layout = [
		{ laneId: "a", top: 0, bottom: 96 },
		{ laneId: "b", top: 96, bottom: 148 },
	];
	expect(laneAtY(layout, 10)).toBe("a");
	expect(laneAtY(layout, 96)).toBe("b");
	expect(laneAtY(layout, 147)).toBe("b");
	expect(laneAtY(layout, -5)).toBeNull();
	expect(laneAtY(layout, 148)).toBeNull();
});

test("resolveDrag move preserves duration and snaps start to a week at month zoom", () => {
	const ws = ms(2026, 0, 1);
	const we = ms(2026, 11, 31);
	const item = { startDate: ms(2026, 1, 10), endDate: ms(2026, 2, 10) };
	const axisWidth = 1200;
	const out = resolveDrag(
		"move",
		item,
		axisWidth / 12,
		ws,
		we,
		axisWidth,
		"month",
	);
	expect(new Date(out.startDate).getDay()).toBe(1); // Monday (week start)
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

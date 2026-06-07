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

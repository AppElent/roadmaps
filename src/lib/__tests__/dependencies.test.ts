import { expect, test } from "vitest";
import {
	dependencyArrows,
	type Edge,
	type ItemRect,
	wouldCreateCycle,
} from "../dependencies";

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
	expect(
		wouldCreateCycle(
			edges([
				["a", "b"],
				["b", "c"],
			]),
			"c",
			"a",
		),
	).toBe(true);
});

test("a non-cyclic edge is allowed", () => {
	expect(wouldCreateCycle(edges([["a", "b"]]), "b", "c")).toBe(false);
	expect(
		wouldCreateCycle(
			edges([
				["a", "b"],
				["a", "c"],
			]),
			"b",
			"c",
		),
	).toBe(false);
});

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

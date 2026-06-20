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

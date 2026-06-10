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

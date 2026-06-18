import { describe, expect, it } from "vitest";
import { reconcileTheme } from "../theme";

describe("reconcileTheme", () => {
	it("returns the Clerk value when it is a valid mode and differs from local", () => {
		expect(reconcileTheme("dark", "light")).toBe("dark");
	});

	it("returns null when Clerk and local already agree", () => {
		expect(reconcileTheme("dark", "dark")).toBeNull();
	});

	it("returns null when Clerk has no stored theme", () => {
		expect(reconcileTheme(undefined, "light")).toBeNull();
	});

	it("returns null when the Clerk value is not a valid mode", () => {
		expect(reconcileTheme("neon", "light")).toBeNull();
	});
});

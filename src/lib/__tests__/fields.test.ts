import { expect, test } from "vitest";
import { emptyValue, type FieldDef, validateValues } from "../fields";

const field = (over: Partial<FieldDef>): FieldDef =>
	({
		_id: "f1" as FieldDef["_id"],
		_creationTime: 0,
		roadmapId: "r1" as FieldDef["roadmapId"],
		userId: "u1",
		key: "status",
		label: "Status",
		type: "select",
		options: [
			{ id: "planned", label: "Planned", color: "#000" },
			{ id: "done", label: "Done", color: "#0f0" },
		],
		order: 0,
		showInTable: true,
		...over,
	}) as FieldDef;

test("select accepts a known option id and rejects an unknown one", () => {
	const fields = [field({})];
	expect(validateValues(fields, { status: "done" })).toEqual({
		status: "done",
	});
	expect(() => validateValues(fields, { status: "nope" })).toThrow();
});

test("number rejects non-numeric values", () => {
	const fields = [field({ key: "score", type: "number", options: undefined })];
	expect(validateValues(fields, { score: 42 })).toEqual({ score: 42 });
	expect(() => validateValues(fields, { score: "high" })).toThrow();
});

test("multiselect validates each id and passes arrays through", () => {
	const fields = [field({ key: "tags", type: "multiselect" })];
	expect(validateValues(fields, { tags: ["planned", "done"] })).toEqual({
		tags: ["planned", "done"],
	});
	expect(() => validateValues(fields, { tags: ["planned", "x"] })).toThrow();
});

test("missing, null, and empty-string values are omitted, unknown keys dropped", () => {
	const fields = [field({ key: "note", type: "text", options: undefined })];
	expect(validateValues(fields, { note: "", extra: "ignored" })).toEqual({});
});

test("emptyValue returns [] for multiselect and null otherwise", () => {
	expect(emptyValue(field({ type: "multiselect" }))).toEqual([]);
	expect(emptyValue(field({ type: "text", options: undefined }))).toBeNull();
});

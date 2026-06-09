import type { Doc } from "@convex/_generated/dataModel";
import { expect, test } from "vitest";
import { parseImport, serializeRoadmap } from "../roadmapIO";

const bundle = {
	roadmap: {
		_id: "r1",
		_creationTime: 0,
		userId: "u",
		name: "R",
		startDate: 0,
		endDate: 1000,
		defaultZoom: "month",
		colorByFieldKey: "status",
		visibility: "private",
		archived: false,
	} as unknown as Doc<"roadmaps">,
	fields: [
		{
			_id: "f1",
			_creationTime: 0,
			roadmapId: "r1",
			userId: "u",
			key: "status",
			label: "Status",
			type: "select",
			options: [{ id: "planned", label: "Planned", color: "#000" }],
			order: 0,
			showInTable: true,
			isSystem: true,
		},
	] as unknown as Doc<"fields">[],
	lanes: [
		{
			_id: "lane_a",
			_creationTime: 0,
			roadmapId: "r1",
			userId: "u",
			name: "A",
			order: 0,
			isDefault: true,
		},
		{
			_id: "lane_b",
			_creationTime: 0,
			roadmapId: "r1",
			userId: "u",
			name: "B",
			order: 1,
		},
	] as unknown as Doc<"lanes">[],
	items: [
		{
			_id: "i1",
			_creationTime: 0,
			roadmapId: "r1",
			laneId: "lane_b",
			userId: "u",
			title: "Item",
			startDate: 10,
			endDate: 20,
			values: { status: "planned" },
			order: 0,
		},
	] as unknown as Doc<"items">[],
	milestones: [] as unknown as Doc<"milestones">[],
};

test("serializeRoadmap references lanes by index", () => {
	const out = serializeRoadmap(bundle);
	expect(out.version).toBe(1);
	expect(out.items[0].laneIndex).toBe(1);
	expect(out.lanes.map((l) => l.name)).toEqual(["A", "B"]);
});

test("parseImport accepts serialized output and rejects junk", () => {
	const json = JSON.stringify(serializeRoadmap(bundle));
	const parsed = parseImport(json);
	expect(parsed.name).toBe("R");
	expect(() => parseImport('{"nope":true}')).toThrow();
	expect(() => parseImport("not json")).toThrow("Invalid JSON");
});

test("parseImport reports friendly errors", () => {
	const valid = serializeRoadmap(bundle);
	const { name: _name, ...missingName } = valid;
	expect(() => parseImport(JSON.stringify(missingName))).toThrow(
		/Missing required field: name/,
	);
	const badDate = { ...valid, startDate: "soon" };
	expect(() => parseImport(JSON.stringify(badDate))).toThrow(
		/Expected date as YYYY-MM-DD/,
	);
	const wrongType = {
		...valid,
		lanes: valid.lanes.map((l) => ({ ...l, order: "first" })),
	};
	expect(() => parseImport(JSON.stringify(wrongType))).toThrow(
		/Wrong type for/,
	);
});

test("serializeRoadmap emits dates as YYYY-MM-DD strings", () => {
	const out = serializeRoadmap(bundle);
	expect(out.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	expect(out.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	expect(out.items[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("date-typed field values round-trip string <-> ms", () => {
	const dueMs = new Date(2026, 5, 9).getTime();
	const dated = {
		...bundle,
		fields: [
			...bundle.fields,
			{
				_id: "f2",
				_creationTime: 0,
				roadmapId: "r1",
				userId: "u",
				key: "due",
				label: "Due",
				type: "date",
				order: 1,
				showInTable: true,
			},
		] as unknown as (typeof bundle)["fields"],
		items: [
			{ ...bundle.items[0], values: { status: "planned", due: dueMs } },
		] as unknown as (typeof bundle)["items"],
	};
	const out = serializeRoadmap(dated);
	expect(out.items[0].values.due).toBe("2026-06-09");
	const parsed = parseImport(JSON.stringify(out));
	expect(parsed.items[0].values.due).toBe(dueMs);
});

test("parseImport accepts legacy numeric dates", () => {
	const out = serializeRoadmap(bundle);
	const legacy = { ...out, startDate: 0, endDate: 1000 };
	const parsed = parseImport(JSON.stringify(legacy));
	expect(parsed.startDate).toBe(0);
	expect(parsed.endDate).toBe(1000);
});

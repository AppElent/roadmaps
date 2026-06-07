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
	expect(() => parseImport("not json")).toThrow();
});

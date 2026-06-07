import type { Doc } from "@convex/_generated/dataModel";
import { expect, test } from "vitest";
import { filterItems, sortItems } from "../itemQuery";

const item = (over: Partial<Doc<"items">>): Doc<"items"> =>
	({
		_id: (over.title ?? "x") as unknown as Doc<"items">["_id"],
		_creationTime: 0,
		roadmapId: "r1" as Doc<"items">["roadmapId"],
		laneId: "lane_a" as Doc<"items">["laneId"],
		userId: "u",
		title: "Untitled",
		startDate: 0,
		endDate: 10,
		values: {},
		order: 0,
		...over,
	}) as Doc<"items">;

const items = [
	item({
		title: "Alpha",
		laneId: "lane_a" as Doc<"items">["laneId"],
		startDate: 30,
		values: { status: "done" },
	}),
	item({
		title: "Beta",
		laneId: "lane_b" as Doc<"items">["laneId"],
		startDate: 10,
		values: { status: "planned" },
	}),
	item({
		title: "Gamma",
		laneId: "lane_a" as Doc<"items">["laneId"],
		startDate: 20,
		values: { status: "planned" },
	}),
];

test("filter by lane", () => {
	const out = filterItems(items, {
		search: "",
		laneId: "lane_a" as Doc<"items">["laneId"],
		fieldKey: null,
		optionId: "all",
	});
	expect(out.map((i) => i.title)).toEqual(["Alpha", "Gamma"]);
});

test("filter by a select field value", () => {
	const out = filterItems(items, {
		search: "",
		laneId: "all",
		fieldKey: "status",
		optionId: "planned",
	});
	expect(out.map((i) => i.title).sort()).toEqual(["Beta", "Gamma"]);
});

test("filter by search across title", () => {
	const out = filterItems(items, {
		search: "alph",
		laneId: "all",
		fieldKey: null,
		optionId: "all",
	});
	expect(out.map((i) => i.title)).toEqual(["Alpha"]);
});

test("sort by startDate ascending and descending", () => {
	const asc = sortItems(items, { key: "startDate", dir: 1 });
	expect(asc.map((i) => i.title)).toEqual(["Beta", "Gamma", "Alpha"]);
	const desc = sortItems(items, { key: "startDate", dir: -1 });
	expect(desc.map((i) => i.title)).toEqual(["Alpha", "Gamma", "Beta"]);
});

test("sort by title", () => {
	const out = sortItems(items, { key: "title", dir: 1 });
	expect(out.map((i) => i.title)).toEqual(["Alpha", "Beta", "Gamma"]);
});

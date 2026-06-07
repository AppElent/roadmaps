import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("create seeds a default status field and default lane", async () => {
	const t = convexTest(schema, modules);
	const asAlex = t.withIdentity({ subject: "user_alex" });
	const roadmapId = await asAlex.mutation(api.roadmaps.create, {
		name: "Platform",
		startDate: 0,
		endDate: 1000,
	});
	const bundle = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.roadmap.name).toBe("Platform");
	expect(bundle.roadmap.colorByFieldKey).toBe("status");
	expect(bundle.fields).toHaveLength(1);
	expect(bundle.fields[0].key).toBe("status");
	expect(bundle.fields[0].isSystem).toBe(true);
	expect(bundle.lanes).toHaveLength(1);
	expect(bundle.lanes[0].isDefault).toBe(true);
});

test("getBundle rejects a non-owner", async () => {
	const t = convexTest(schema, modules);
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 1 });
	await expect(
		t.withIdentity({ subject: "user_mallory" }).query(api.roadmaps.getBundle, {
			roadmapId,
		}),
	).rejects.toThrow(/access denied/);
});

test("unauthenticated create is rejected", async () => {
	const t = convexTest(schema, modules);
	await expect(
		t.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 1 }),
	).rejects.toThrow(/Not authenticated/);
});

test("duplicate clones fields, lanes, and items", async () => {
	const t = convexTest(schema, modules);
	const asAlex = t.withIdentity({ subject: "user_alex" });
	const roadmapId = await asAlex.mutation(api.roadmaps.create, {
		name: "R",
		startDate: 0,
		endDate: 1000,
	});
	const bundle = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	await asAlex.mutation(api.items.create, {
		roadmapId,
		laneId: bundle.lanes[0]._id,
		title: "Item A",
		startDate: 10,
		endDate: 20,
		values: { status: "planned" },
	});
	const copyId = await asAlex.mutation(api.roadmaps.duplicate, { roadmapId });
	const copy = await asAlex.query(api.roadmaps.getBundle, { roadmapId: copyId });
	expect(copy.roadmap.name).toBe("R (copy)");
	expect(copy.fields).toHaveLength(1);
	expect(copy.lanes).toHaveLength(1);
	expect(copy.items).toHaveLength(1);
	expect(copy.items[0].title).toBe("Item A");
});

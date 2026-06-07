import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
	const t = convexTest(schema, modules);
	const asAlex = t.withIdentity({ subject: "user_alex" });
	const roadmapId = await asAlex.mutation(api.roadmaps.create, {
		name: "R",
		startDate: 0,
		endDate: 1000,
	});
	return { t, asAlex, roadmapId };
}

test("deleting a lane moves its items to the target lane", async () => {
	const { asAlex, roadmapId } = await setup();
	const bundle = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	const defaultLane = bundle.lanes[0]._id;
	const laneB = await asAlex.mutation(api.lanes.create, { roadmapId, name: "B" });
	await asAlex.mutation(api.items.create, {
		roadmapId,
		laneId: laneB,
		title: "Item",
		startDate: 1,
		endDate: 2,
		values: {},
	});
	await asAlex.mutation(api.lanes.remove, {
		laneId: laneB,
		moveToLaneId: defaultLane,
	});
	const after = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	expect(after.lanes).toHaveLength(1);
	expect(after.items[0].laneId).toBe(defaultLane);
});

test("the last lane cannot be deleted", async () => {
	const { asAlex, roadmapId } = await setup();
	const bundle = await asAlex.query(api.roadmaps.getBundle, { roadmapId });
	await expect(
		asAlex.mutation(api.lanes.remove, {
			laneId: bundle.lanes[0]._id,
			moveToLaneId: bundle.lanes[0]._id,
		}),
	).rejects.toThrow(/last lane/);
});

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("a non-owner cannot create an item", async () => {
	const t = convexTest(schema, modules);
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 100 });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	await expect(
		t.withIdentity({ subject: "user_mallory" }).mutation(api.items.create, {
			roadmapId,
			laneId: bundle.lanes[0]._id,
			title: "x",
			startDate: 0,
			endDate: 1,
			values: {},
		}),
	).rejects.toThrow(/access denied/);
});

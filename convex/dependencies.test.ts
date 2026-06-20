import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup(t: ReturnType<typeof convexTest>) {
	const roadmapId = await t
		.withIdentity({ subject: "user_alex" })
		.mutation(api.roadmaps.create, { name: "R", startDate: 0, endDate: 100 });
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	const laneId = bundle.lanes[0]._id;
	const mkItem = (title: string) =>
		t.withIdentity({ subject: "user_alex" }).mutation(api.items.create, {
			roadmapId,
			laneId,
			title,
			startDate: 0,
			endDate: 10,
			values: {},
		});
	return { roadmapId, laneId, mkItem };
}

test("getBundle includes an empty dependencies array", async () => {
	const t = convexTest(schema, modules);
	const { roadmapId } = await setup(t);
	const bundle = await t
		.withIdentity({ subject: "user_alex" })
		.query(api.roadmaps.getBundle, { roadmapId });
	expect(bundle.dependencies).toEqual([]);
});

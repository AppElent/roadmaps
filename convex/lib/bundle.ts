import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const byOrder = <T extends { order: number }>(rows: T[]): T[] =>
	[...rows].sort((a, b) => a.order - b.order);

export async function loadRoadmapChildren(
	ctx: QueryCtx | MutationCtx,
	roadmapId: Id<"roadmaps">,
) {
	const [fields, lanes, items, milestones, dependencies] = await Promise.all([
		ctx.db
			.query("fields")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
		ctx.db
			.query("lanes")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
		ctx.db
			.query("items")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
		ctx.db
			.query("milestones")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
		ctx.db
			.query("dependencies")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
			.collect(),
	]);
	return {
		fields: byOrder(fields),
		lanes: byOrder(lanes),
		items: byOrder(items),
		milestones,
		dependencies,
	};
}

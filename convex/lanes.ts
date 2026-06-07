import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		name: v.string(),
		color: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		const existing = await ctx.db
			.query("lanes")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", args.roadmapId))
			.collect();
		const order = existing.reduce((max, l) => Math.max(max, l.order), -1) + 1;
		return await ctx.db.insert("lanes", {
			roadmapId: args.roadmapId,
			userId,
			name: args.name,
			color: args.color,
			order,
		});
	},
});

export const update = mutation({
	args: {
		laneId: v.id("lanes"),
		name: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const lane = await ctx.db.get(args.laneId);
		if (!lane) throw new Error("Lane not found");
		await requireRoadmapOwner(ctx, lane.roadmapId);
		const { laneId, ...patch } = args;
		await ctx.db.patch(laneId, patch);
	},
});

export const reorder = mutation({
	args: { laneId: v.id("lanes"), order: v.number() },
	handler: async (ctx, args) => {
		const lane = await ctx.db.get(args.laneId);
		if (!lane) throw new Error("Lane not found");
		await requireRoadmapOwner(ctx, lane.roadmapId);
		await ctx.db.patch(args.laneId, { order: args.order });
	},
});

export const remove = mutation({
	args: { laneId: v.id("lanes"), moveToLaneId: v.id("lanes") },
	handler: async (ctx, args) => {
		const lane = await ctx.db.get(args.laneId);
		if (!lane) throw new Error("Lane not found");
		await requireRoadmapOwner(ctx, lane.roadmapId);
		const lanes = await ctx.db
			.query("lanes")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", lane.roadmapId))
			.collect();
		if (lanes.length <= 1) throw new Error("Cannot delete the last lane");
		const target = await ctx.db.get(args.moveToLaneId);
		if (!target || target.roadmapId !== lane.roadmapId) {
			throw new Error("Invalid target lane");
		}
		const items = await ctx.db
			.query("items")
			.withIndex("by_roadmap_lane", (q) =>
				q.eq("roadmapId", lane.roadmapId).eq("laneId", args.laneId),
			)
			.collect();
		for (const item of items) {
			await ctx.db.patch(item._id, { laneId: args.moveToLaneId });
		}
		await ctx.db.delete(args.laneId);
	},
});

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { fieldValueValidator } from "./schema";

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		laneId: v.id("lanes"),
		title: v.string(),
		startDate: v.number(),
		endDate: v.number(),
		description: v.optional(v.string()),
		values: v.record(v.string(), fieldValueValidator),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		const existing = await ctx.db
			.query("items")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", args.roadmapId))
			.collect();
		const order = existing.reduce((max, i) => Math.max(max, i.order), -1) + 1;
		return await ctx.db.insert("items", {
			roadmapId: args.roadmapId,
			laneId: args.laneId,
			userId,
			title: args.title,
			startDate: args.startDate,
			endDate: args.endDate,
			description: args.description,
			values: args.values,
			order,
		});
	},
});

export const update = mutation({
	args: {
		itemId: v.id("items"),
		laneId: v.optional(v.id("lanes")),
		title: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		description: v.optional(v.string()),
		values: v.optional(v.record(v.string(), fieldValueValidator)),
		order: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.itemId);
		if (!item) throw new Error("Item not found");
		await requireRoadmapOwner(ctx, item.roadmapId);
		const { itemId, ...patch } = args;
		await ctx.db.patch(itemId, patch);
	},
});

export const remove = mutation({
	args: { itemId: v.id("items") },
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.itemId);
		if (!item) throw new Error("Item not found");
		await requireRoadmapOwner(ctx, item.roadmapId);
		const [asPred, asSucc] = await Promise.all([
			ctx.db
				.query("dependencies")
				.withIndex("by_predecessor", (q) =>
					q.eq("predecessorId", args.itemId),
				)
				.collect(),
			ctx.db
				.query("dependencies")
				.withIndex("by_successor", (q) => q.eq("successorId", args.itemId))
				.collect(),
		]);
		for (const dep of [...asPred, ...asSucc]) {
			await ctx.db.delete(dep._id);
		}
		await ctx.db.delete(args.itemId);
	},
});

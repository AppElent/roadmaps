import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		name: v.string(),
		date: v.number(),
		color: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		const { roadmapId, ...rest } = args;
		return await ctx.db.insert("milestones", { roadmapId, userId, ...rest });
	},
});

export const update = mutation({
	args: {
		milestoneId: v.id("milestones"),
		name: v.optional(v.string()),
		date: v.optional(v.number()),
		color: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const milestone = await ctx.db.get(args.milestoneId);
		if (!milestone) throw new Error("Milestone not found");
		await requireRoadmapOwner(ctx, milestone.roadmapId);
		const { milestoneId, ...patch } = args;
		await ctx.db.patch(milestoneId, patch);
	},
});

export const remove = mutation({
	args: { milestoneId: v.id("milestones") },
	handler: async (ctx, args) => {
		const milestone = await ctx.db.get(args.milestoneId);
		if (!milestone) throw new Error("Milestone not found");
		await requireRoadmapOwner(ctx, milestone.roadmapId);
		await ctx.db.delete(args.milestoneId);
	},
});

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { fieldOptionValidator, fieldTypeValidator } from "./schema";

export const create = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		key: v.string(),
		label: v.string(),
		type: fieldTypeValidator,
		options: v.optional(v.array(fieldOptionValidator)),
		showInTable: v.boolean(),
		order: v.number(),
	},
	handler: async (ctx, args) => {
		const { userId } = await requireRoadmapOwner(ctx, args.roadmapId);
		const { roadmapId, ...rest } = args;
		return await ctx.db.insert("fields", { roadmapId, userId, ...rest });
	},
});

export const update = mutation({
	args: {
		fieldId: v.id("fields"),
		label: v.optional(v.string()),
		options: v.optional(v.array(fieldOptionValidator)),
		showInTable: v.optional(v.boolean()),
		order: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const field = await ctx.db.get(args.fieldId);
		if (!field) throw new Error("Field not found");
		await requireRoadmapOwner(ctx, field.roadmapId);
		const { fieldId, ...patch } = args;
		await ctx.db.patch(fieldId, patch);
	},
});

export const reorder = mutation({
	args: { fieldId: v.id("fields"), order: v.number() },
	handler: async (ctx, args) => {
		const field = await ctx.db.get(args.fieldId);
		if (!field) throw new Error("Field not found");
		await requireRoadmapOwner(ctx, field.roadmapId);
		await ctx.db.patch(args.fieldId, { order: args.order });
	},
});

export const remove = mutation({
	args: { fieldId: v.id("fields") },
	handler: async (ctx, args) => {
		const field = await ctx.db.get(args.fieldId);
		if (!field) throw new Error("Field not found");
		if (field.isSystem) throw new Error("System fields cannot be deleted");
		await requireRoadmapOwner(ctx, field.roadmapId);
		const items = await ctx.db
			.query("items")
			.withIndex("by_roadmap", (q) => q.eq("roadmapId", field.roadmapId))
			.collect();
		for (const item of items) {
			if (field.key in item.values) {
				const { [field.key]: _removed, ...rest } = item.values;
				await ctx.db.patch(item._id, { values: rest });
			}
		}
		await ctx.db.delete(args.fieldId);
	},
});

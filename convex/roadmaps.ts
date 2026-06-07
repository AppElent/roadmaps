import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireRoadmapOwner, requireUser } from "./lib/auth";
import { loadRoadmapChildren } from "./lib/bundle";
import { DEFAULT_STATUS_OPTIONS, STATUS_FIELD_KEY } from "./lib/defaults";
import { zoomValidator } from "./schema";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		const roadmaps = await ctx.db
			.query("roadmaps")
			.withIndex("by_user_archived", (q) =>
				q.eq("userId", userId).eq("archived", false),
			)
			.collect();
		return await Promise.all(
			roadmaps.map(async (roadmap) => {
				const items = await ctx.db
					.query("items")
					.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmap._id))
					.collect();
				return { ...roadmap, itemCount: items.length };
			}),
		);
	},
});

export const get = query({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		const { roadmap } = await requireRoadmapOwner(ctx, args.roadmapId);
		return roadmap;
	},
});

export const getBundle = query({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		const { roadmap } = await requireRoadmapOwner(ctx, args.roadmapId);
		return { roadmap, ...(await loadRoadmapChildren(ctx, args.roadmapId)) };
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		startDate: v.number(),
		endDate: v.number(),
		defaultZoom: v.optional(zoomValidator),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		const roadmapId = await ctx.db.insert("roadmaps", {
			userId,
			name: args.name,
			description: args.description,
			startDate: args.startDate,
			endDate: args.endDate,
			defaultZoom: args.defaultZoom ?? "month",
			colorByFieldKey: STATUS_FIELD_KEY,
			visibility: "private",
			archived: false,
		});
		await ctx.db.insert("fields", {
			roadmapId,
			userId,
			key: STATUS_FIELD_KEY,
			label: "Status",
			type: "select",
			options: DEFAULT_STATUS_OPTIONS,
			order: 0,
			showInTable: true,
			isSystem: true,
		});
		await ctx.db.insert("lanes", {
			roadmapId,
			userId,
			name: "General",
			order: 0,
			isDefault: true,
		});
		return roadmapId;
	},
});

export const update = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		defaultZoom: v.optional(zoomValidator),
		colorByFieldKey: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireRoadmapOwner(ctx, args.roadmapId);
		const { roadmapId, ...patch } = args;
		await ctx.db.patch(roadmapId, patch);
	},
});

export const archive = mutation({
	args: { roadmapId: v.id("roadmaps"), archived: v.boolean() },
	handler: async (ctx, args) => {
		await requireRoadmapOwner(ctx, args.roadmapId);
		await ctx.db.patch(args.roadmapId, { archived: args.archived });
	},
});

export const enableShare = mutation({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		const { roadmap } = await requireRoadmapOwner(ctx, args.roadmapId);
		const token = roadmap.shareToken ?? crypto.randomUUID().replace(/-/g, "");
		await ctx.db.patch(args.roadmapId, {
			visibility: "link",
			shareToken: token,
		});
		return token;
	},
});

export const disableShare = mutation({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		await requireRoadmapOwner(ctx, args.roadmapId);
		await ctx.db.patch(args.roadmapId, {
			visibility: "private",
			shareToken: undefined,
		});
	},
});

export const duplicate = mutation({
	args: { roadmapId: v.id("roadmaps") },
	handler: async (ctx, args) => {
		const { userId, roadmap } = await requireRoadmapOwner(ctx, args.roadmapId);
		const children = await loadRoadmapChildren(ctx, args.roadmapId);
		const newId = await ctx.db.insert("roadmaps", {
			userId,
			name: `${roadmap.name} (copy)`,
			description: roadmap.description,
			startDate: roadmap.startDate,
			endDate: roadmap.endDate,
			defaultZoom: roadmap.defaultZoom,
			colorByFieldKey: roadmap.colorByFieldKey,
			visibility: "private",
			archived: false,
		});
		for (const f of children.fields) {
			await ctx.db.insert("fields", {
				roadmapId: newId,
				userId,
				key: f.key,
				label: f.label,
				type: f.type,
				options: f.options,
				order: f.order,
				showInTable: f.showInTable,
				isSystem: f.isSystem,
			});
		}
		const laneIdMap = new Map<Id<"lanes">, Id<"lanes">>();
		for (const l of children.lanes) {
			const cloneId = await ctx.db.insert("lanes", {
				roadmapId: newId,
				userId,
				name: l.name,
				color: l.color,
				order: l.order,
				isDefault: l.isDefault,
			});
			laneIdMap.set(l._id, cloneId);
		}
		for (const it of children.items) {
			await ctx.db.insert("items", {
				roadmapId: newId,
				laneId: laneIdMap.get(it.laneId) as Id<"lanes">,
				userId,
				title: it.title,
				startDate: it.startDate,
				endDate: it.endDate,
				description: it.description,
				values: it.values,
				order: it.order,
			});
		}
		for (const m of children.milestones) {
			await ctx.db.insert("milestones", {
				roadmapId: newId,
				userId,
				name: m.name,
				date: m.date,
				color: m.color,
			});
		}
		return newId;
	},
});

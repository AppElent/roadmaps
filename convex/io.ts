import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireUser } from "./lib/auth";
import {
	fieldOptionValidator,
	fieldTypeValidator,
	fieldValueValidator,
	zoomValidator,
} from "./schema";

export const importRoadmap = mutation({
	args: {
		payload: v.object({
			name: v.string(),
			startDate: v.number(),
			endDate: v.number(),
			defaultZoom: zoomValidator,
			colorByFieldKey: v.optional(v.string()),
			fields: v.array(
				v.object({
					key: v.string(),
					label: v.string(),
					type: fieldTypeValidator,
					options: v.optional(v.array(fieldOptionValidator)),
					order: v.number(),
					showInTable: v.boolean(),
					isSystem: v.optional(v.boolean()),
				}),
			),
			lanes: v.array(
				v.object({
					name: v.string(),
					color: v.optional(v.string()),
					order: v.number(),
					isDefault: v.optional(v.boolean()),
				}),
			),
			items: v.array(
				v.object({
					title: v.string(),
					laneIndex: v.number(),
					startDate: v.number(),
					endDate: v.number(),
					description: v.optional(v.string()),
					values: v.record(v.string(), fieldValueValidator),
					order: v.number(),
				}),
			),
			milestones: v.array(
				v.object({
					name: v.string(),
					date: v.number(),
					color: v.optional(v.string()),
				}),
			),
		}),
	},
	handler: async (ctx, { payload }) => {
		const userId = await requireUser(ctx);
		const roadmapId = await ctx.db.insert("roadmaps", {
			userId,
			name: payload.name,
			startDate: payload.startDate,
			endDate: payload.endDate,
			defaultZoom: payload.defaultZoom,
			colorByFieldKey: payload.colorByFieldKey,
			visibility: "private",
			archived: false,
		});

		for (const f of payload.fields) {
			await ctx.db.insert("fields", { roadmapId, userId, ...f });
		}

		const lanes = payload.lanes.length
			? payload.lanes
			: [{ name: "General", order: 0, isDefault: true }];
		const laneIds: Id<"lanes">[] = [];
		for (let i = 0; i < lanes.length; i++) {
			const lane = lanes[i];
			const id = await ctx.db.insert("lanes", {
				roadmapId,
				userId,
				name: lane.name,
				color: lane.color,
				order: lane.order,
				isDefault: lane.isDefault ?? i === 0,
			});
			laneIds.push(id);
		}

		for (const it of payload.items) {
			const laneId = laneIds[it.laneIndex] ?? laneIds[0];
			await ctx.db.insert("items", {
				roadmapId,
				laneId,
				userId,
				title: it.title,
				startDate: it.startDate,
				endDate: it.endDate,
				description: it.description,
				values: it.values,
				order: it.order,
			});
		}

		for (const m of payload.milestones) {
			await ctx.db.insert("milestones", { roadmapId, userId, ...m });
		}

		return roadmapId;
	},
});

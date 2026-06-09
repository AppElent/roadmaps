import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireRoadmapOwner } from "./lib/auth";
import { loadRoadmapChildren } from "./lib/bundle";
import { roadmapSnapshotValidator } from "./schema";

export const replaceRoadmap = mutation({
	args: {
		roadmapId: v.id("roadmaps"),
		payload: roadmapSnapshotValidator,
	},
	handler: async (ctx, { roadmapId, payload }) => {
		const { userId } = await requireRoadmapOwner(ctx, roadmapId);

		const existing = await loadRoadmapChildren(ctx, roadmapId);
		for (const row of [
			...existing.fields,
			...existing.lanes,
			...existing.items,
			...existing.milestones,
		]) {
			await ctx.db.delete(row._id);
		}

		await ctx.db.patch(roadmapId, {
			name: payload.name,
			startDate: payload.startDate,
			endDate: payload.endDate,
			defaultZoom: payload.defaultZoom,
			colorByFieldKey: payload.colorByFieldKey,
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
	},
});

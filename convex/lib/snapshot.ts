import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { loadRoadmapChildren } from "./bundle";
import { roadmapSnapshotValidator } from "../schema";

export const MAX_VERSIONS = 25;

export type RoadmapSnapshot = Infer<typeof roadmapSnapshotValidator>;

/** Builds a full snapshot payload from the roadmap's current state. */
export async function snapshotRoadmap(
	ctx: MutationCtx,
	roadmapId: Id<"roadmaps">,
): Promise<RoadmapSnapshot> {
	const roadmap = await ctx.db.get(roadmapId);
	if (!roadmap) throw new Error("Roadmap not found");
	const { fields, lanes, items, milestones, dependencies } =
		await loadRoadmapChildren(ctx, roadmapId);
	const laneIndex = new Map<Id<"lanes">, number>();
	lanes.forEach((lane, i) => laneIndex.set(lane._id, i));
	const itemIndex = new Map<Id<"items">, number>();
	items.forEach((item, i) => itemIndex.set(item._id, i));
	return {
		name: roadmap.name,
		startDate: roadmap.startDate,
		endDate: roadmap.endDate,
		defaultZoom: roadmap.defaultZoom,
		colorByFieldKey: roadmap.colorByFieldKey,
		barColorMode: roadmap.barColorMode,
		fields: fields.map((f) => ({
			key: f.key,
			label: f.label,
			type: f.type,
			options: f.options,
			order: f.order,
			showInTable: f.showInTable,
			isSystem: f.isSystem,
		})),
		lanes: lanes.map((l) => ({
			name: l.name,
			color: l.color,
			order: l.order,
			isDefault: l.isDefault,
		})),
		items: items.map((it) => ({
			title: it.title,
			laneIndex: laneIndex.get(it.laneId) ?? 0,
			startDate: it.startDate,
			endDate: it.endDate,
			description: it.description,
			values: it.values,
			order: it.order,
		})),
		milestones: milestones.map((m) => ({
			name: m.name,
			date: m.date,
			color: m.color,
		})),
		dependencies: dependencies
			.filter(
				(d) =>
					itemIndex.has(d.predecessorId) && itemIndex.has(d.successorId),
			)
			.map((d) => ({
				predecessorIndex: itemIndex.get(d.predecessorId) as number,
				successorIndex: itemIndex.get(d.successorId) as number,
			})),
	};
}

/** Replaces a roadmap's children with the snapshot's contents. */
export async function applySnapshot(
	ctx: MutationCtx,
	roadmapId: Id<"roadmaps">,
	userId: string,
	snapshot: RoadmapSnapshot,
): Promise<void> {
	const existing = await loadRoadmapChildren(ctx, roadmapId);
	for (const row of [
		...existing.fields,
		...existing.lanes,
		...existing.items,
		...existing.milestones,
		...existing.dependencies,
	]) {
		await ctx.db.delete(row._id);
	}

	await ctx.db.patch(roadmapId, {
		name: snapshot.name,
		startDate: snapshot.startDate,
		endDate: snapshot.endDate,
		defaultZoom: snapshot.defaultZoom,
		colorByFieldKey: snapshot.colorByFieldKey,
		barColorMode: snapshot.barColorMode,
	});

	for (const f of snapshot.fields) {
		await ctx.db.insert("fields", { roadmapId, userId, ...f });
	}

	const lanes = snapshot.lanes.length
		? snapshot.lanes
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

	const itemIds: Id<"items">[] = [];
	for (const it of snapshot.items) {
		const laneId = laneIds[it.laneIndex] ?? laneIds[0];
		const id = await ctx.db.insert("items", {
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
		itemIds.push(id);
	}

	for (const m of snapshot.milestones) {
		await ctx.db.insert("milestones", { roadmapId, userId, ...m });
	}

	for (const d of snapshot.dependencies ?? []) {
		const predecessorId = itemIds[d.predecessorIndex];
		const successorId = itemIds[d.successorIndex];
		if (!predecessorId || !successorId) continue;
		await ctx.db.insert("dependencies", {
			roadmapId,
			userId,
			predecessorId,
			successorId,
		});
	}
}

/** Snapshots current state into a roadmapVersions row, then prunes to MAX_VERSIONS (oldest first). */
export async function saveVersion(
	ctx: MutationCtx,
	roadmapId: Id<"roadmaps">,
	userId: string,
	label: string,
	kind: "manual" | "auto",
): Promise<void> {
	const snapshot = await snapshotRoadmap(ctx, roadmapId);
	await ctx.db.insert("roadmapVersions", { roadmapId, userId, label, kind, snapshot });

	const all = await ctx.db
		.query("roadmapVersions")
		.withIndex("by_roadmap", (q) => q.eq("roadmapId", roadmapId))
		.collect();
	if (all.length > MAX_VERSIONS) {
		const oldest = [...all]
			.sort((a, b) => a._creationTime - b._creationTime)
			.slice(0, all.length - MAX_VERSIONS);
		for (const row of oldest) {
			await ctx.db.delete(row._id);
		}
	}
}

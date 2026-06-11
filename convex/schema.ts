import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const zoomValidator = v.union(
	v.literal("week"),
	v.literal("month"),
	v.literal("quarter"),
	v.literal("half"),
);

export const barColorModeValidator = v.union(
	v.literal("left"),
	v.literal("fill"),
);

export const fieldTypeValidator = v.union(
	v.literal("text"),
	v.literal("number"),
	v.literal("date"),
	v.literal("select"),
	v.literal("multiselect"),
);

export const fieldOptionValidator = v.object({
	id: v.string(),
	label: v.string(),
	color: v.string(),
});

export const fieldValueValidator = v.union(
	v.string(),
	v.number(),
	v.array(v.string()),
	v.null(),
);

export const roadmapSnapshotValidator = v.object({
	name: v.string(),
	startDate: v.number(),
	endDate: v.number(),
	defaultZoom: zoomValidator,
	colorByFieldKey: v.optional(v.string()),
	barColorMode: v.optional(barColorModeValidator),
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
});

export const diagramTypeValidator = v.union(
	v.literal("mermaid"),
	v.literal("plantuml"),
);

export const diagramSnapshotValidator = v.object({
	title: v.string(),
	type: diagramTypeValidator,
	source: v.string(),
});

export default defineSchema({
	roadmaps: defineTable({
		userId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		startDate: v.number(),
		endDate: v.number(),
		defaultZoom: zoomValidator,
		colorByFieldKey: v.optional(v.string()),
		barColorMode: v.optional(barColorModeValidator),
		visibility: v.union(v.literal("private"), v.literal("link")),
		shareToken: v.optional(v.string()),
		archived: v.boolean(),
	})
		.index("by_user", ["userId"])
		.index("by_user_archived", ["userId", "archived"])
		.index("by_shareToken", ["shareToken"]),

	fields: defineTable({
		roadmapId: v.id("roadmaps"),
		userId: v.string(),
		key: v.string(),
		label: v.string(),
		type: fieldTypeValidator,
		options: v.optional(v.array(fieldOptionValidator)),
		order: v.number(),
		showInTable: v.boolean(),
		isSystem: v.optional(v.boolean()),
	}).index("by_roadmap", ["roadmapId"]),

	lanes: defineTable({
		roadmapId: v.id("roadmaps"),
		userId: v.string(),
		name: v.string(),
		color: v.optional(v.string()),
		order: v.number(),
		isDefault: v.optional(v.boolean()),
	}).index("by_roadmap", ["roadmapId"]),

	items: defineTable({
		roadmapId: v.id("roadmaps"),
		laneId: v.id("lanes"),
		userId: v.string(),
		title: v.string(),
		startDate: v.number(),
		endDate: v.number(),
		description: v.optional(v.string()),
		values: v.record(v.string(), fieldValueValidator),
		order: v.number(),
	})
		.index("by_roadmap", ["roadmapId"])
		.index("by_roadmap_lane", ["roadmapId", "laneId"]),

	milestones: defineTable({
		roadmapId: v.id("roadmaps"),
		userId: v.string(),
		name: v.string(),
		date: v.number(),
		color: v.optional(v.string()),
	}).index("by_roadmap", ["roadmapId"]),

	roadmapVersions: defineTable({
		roadmapId: v.id("roadmaps"),
		userId: v.string(),
		label: v.string(),
		kind: v.union(v.literal("manual"), v.literal("auto")),
		snapshot: roadmapSnapshotValidator,
	}).index("by_roadmap", ["roadmapId"]),

	diagrams: defineTable({
		userId: v.string(),
		title: v.string(),
		type: diagramTypeValidator,
		source: v.string(),
		visibility: v.union(v.literal("private"), v.literal("link")),
		shareToken: v.optional(v.string()),
		archived: v.boolean(),
	})
		.index("by_user", ["userId"])
		.index("by_shareToken", ["shareToken"]),

	diagramVersions: defineTable({
		diagramId: v.id("diagrams"),
		userId: v.string(),
		label: v.string(),
		kind: v.union(v.literal("manual"), v.literal("auto")),
		snapshot: diagramSnapshotValidator,
	}).index("by_diagram", ["diagramId"]),
});

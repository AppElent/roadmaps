import type { Doc } from "@convex/_generated/dataModel";
import { z } from "zod";
import type { TimelineBundle } from "@/components/timeline/TimelineView";

const optionSchema = z.object({
	id: z.string(),
	label: z.string(),
	color: z.string(),
});

const valueSchema = z.union([
	z.string(),
	z.number(),
	z.array(z.string()),
	z.null(),
]);

export const roadmapExportSchema = z.object({
	version: z.literal(1),
	name: z.string(),
	startDate: z.number(),
	endDate: z.number(),
	defaultZoom: z.enum(["week", "month", "quarter", "half"]),
	colorByFieldKey: z.string().optional(),
	fields: z.array(
		z.object({
			key: z.string(),
			label: z.string(),
			type: z.enum(["text", "number", "date", "select", "multiselect"]),
			options: z.array(optionSchema).optional(),
			order: z.number(),
			showInTable: z.boolean(),
			isSystem: z.boolean().optional(),
		}),
	),
	lanes: z.array(
		z.object({
			name: z.string(),
			color: z.string().optional(),
			order: z.number(),
			isDefault: z.boolean().optional(),
		}),
	),
	items: z.array(
		z.object({
			title: z.string(),
			laneIndex: z.number(),
			startDate: z.number(),
			endDate: z.number(),
			description: z.string().optional(),
			values: z.record(z.string(), valueSchema),
			order: z.number(),
		}),
	),
	milestones: z.array(
		z.object({
			name: z.string(),
			date: z.number(),
			color: z.string().optional(),
		}),
	),
});

export type RoadmapExport = z.infer<typeof roadmapExportSchema>;

export function serializeRoadmap(bundle: TimelineBundle): RoadmapExport {
	const laneIndex = new Map<Doc<"lanes">["_id"], number>();
	bundle.lanes.forEach((lane, i) => {
		laneIndex.set(lane._id, i);
	});
	return {
		version: 1,
		name: bundle.roadmap.name,
		startDate: bundle.roadmap.startDate,
		endDate: bundle.roadmap.endDate,
		defaultZoom: bundle.roadmap.defaultZoom,
		colorByFieldKey: bundle.roadmap.colorByFieldKey,
		fields: bundle.fields.map((f) => ({
			key: f.key,
			label: f.label,
			type: f.type,
			options: f.options,
			order: f.order,
			showInTable: f.showInTable,
			isSystem: f.isSystem,
		})),
		lanes: bundle.lanes.map((l) => ({
			name: l.name,
			color: l.color,
			order: l.order,
			isDefault: l.isDefault,
		})),
		items: bundle.items.map((it) => ({
			title: it.title,
			laneIndex: laneIndex.get(it.laneId) ?? 0,
			startDate: it.startDate,
			endDate: it.endDate,
			description: it.description,
			values: it.values,
			order: it.order,
		})),
		milestones: bundle.milestones.map((m) => ({
			name: m.name,
			date: m.date,
			color: m.color,
		})),
	};
}

function formatIssues(error: z.ZodError): string {
	const lines = error.issues.slice(0, 3).map((issue) => {
		const path = issue.path.length
			? issue.path.map(String).join(".")
			: "(root)";
		if (issue.code === "invalid_type") {
			if (/received undefined/i.test(issue.message)) {
				return `Missing required field: ${path}`;
			}
			const detail = issue.message.replace(/^Invalid input:\s*/i, "");
			return `Wrong type for ${path}: ${detail}`;
		}
		return `${path}: ${issue.message}`;
	});
	const extra = error.issues.length - lines.length;
	if (extra > 0) {
		lines.push(`…and ${extra} more issue${extra === 1 ? "" : "s"}`);
	}
	return lines.join("\n");
}

export function parseImport(text: string): RoadmapExport {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error("Invalid JSON");
	}
	const result = roadmapExportSchema.safeParse(raw);
	if (!result.success) {
		throw new Error(formatIssues(result.error));
	}
	return result.data;
}

import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireDiagramOwner } from "./lib/auth";

export const MAX_DIAGRAM_VERSIONS = 25;

/** Snapshots the diagram into a diagramVersions row, then prunes to the cap (oldest first). */
export async function saveDiagramVersion(
	ctx: MutationCtx,
	diagram: Doc<"diagrams">,
	label: string,
	kind: "manual" | "auto",
): Promise<void> {
	await ctx.db.insert("diagramVersions", {
		diagramId: diagram._id,
		userId: diagram.userId,
		label,
		kind,
		snapshot: {
			title: diagram.title,
			type: diagram.type,
			source: diagram.source,
		},
	});
	const all = await ctx.db
		.query("diagramVersions")
		.withIndex("by_diagram", (q) => q.eq("diagramId", diagram._id))
		.collect();
	if (all.length > MAX_DIAGRAM_VERSIONS) {
		const oldest = [...all]
			.sort((a, b) => a._creationTime - b._creationTime)
			.slice(0, all.length - MAX_DIAGRAM_VERSIONS);
		for (const row of oldest) {
			await ctx.db.delete(row._id);
		}
	}
}

export const list = query({
	args: { diagramId: v.id("diagrams") },
	handler: async (ctx, { diagramId }) => {
		await requireDiagramOwner(ctx, diagramId);
		const versions = await ctx.db
			.query("diagramVersions")
			.withIndex("by_diagram", (q) => q.eq("diagramId", diagramId))
			.collect();
		return versions
			.sort((a, b) => b._creationTime - a._creationTime)
			.map((row) => ({
				_id: row._id,
				label: row.label,
				kind: row.kind,
				_creationTime: row._creationTime,
			}));
	},
});

export const create = mutation({
	args: { diagramId: v.id("diagrams"), label: v.string() },
	handler: async (ctx, { diagramId, label }) => {
		const { diagram } = await requireDiagramOwner(ctx, diagramId);
		const existing = await ctx.db
			.query("diagramVersions")
			.withIndex("by_diagram", (q) => q.eq("diagramId", diagramId))
			.collect();
		const finalLabel = label.trim() || `Version ${existing.length + 1}`;
		await saveDiagramVersion(ctx, diagram, finalLabel, "manual");
	},
});

export const restore = mutation({
	args: { versionId: v.id("diagramVersions") },
	handler: async (ctx, { versionId }) => {
		const version = await ctx.db.get(versionId);
		if (!version) throw new Error("Version not found");
		const { diagram } = await requireDiagramOwner(ctx, version.diagramId);
		await saveDiagramVersion(ctx, diagram, "Before restore", "auto");
		await ctx.db.patch(diagram._id, {
			title: version.snapshot.title,
			type: version.snapshot.type,
			source: version.snapshot.source,
		});
	},
});

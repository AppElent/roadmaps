import type { ConvexHttpClient } from "convex/browser";
import { describe, expect, it, vi } from "vitest";
import { createDocTools, readDocument } from "@/lib/ai/tools";

const D = (s: string) => new Date(`${s}T00:00:00`).getTime();

/** Minimal getBundle-shaped fixture (what serializeRoadmap consumes). */
const bundle = {
	roadmap: {
		_id: "rm1",
		name: "R",
		startDate: D("2026-01-01"),
		endDate: D("2026-12-31"),
		defaultZoom: "month",
	},
	fields: [
		{
			key: "status",
			label: "Status",
			type: "select",
			options: [{ id: "todo", label: "To do", color: "#888888" }],
			order: 0,
			showInTable: true,
			isSystem: true,
		},
	],
	lanes: [{ _id: "lane1", name: "Lane A", order: 0, isDefault: true }],
	items: [
		{
			_id: "item1",
			title: "Item 1",
			laneId: "lane1",
			startDate: D("2026-02-01"),
			endDate: D("2026-03-01"),
			values: { status: "todo" },
			order: 0,
		},
	],
	milestones: [],
	dependencies: [],
};

function fakeConvex(overrides: Partial<Record<"query" | "mutation", unknown>>) {
	return {
		query: vi.fn().mockResolvedValue(bundle),
		mutation: vi.fn().mockResolvedValue(null),
		...overrides,
	} as unknown as ConvexHttpClient;
}

const roadmapRef = { kind: "roadmap", id: "rm1" } as const;
const diagramRef = { kind: "diagram", id: "dg1" } as const;

describe("readDocument", () => {
	it("serializes a roadmap bundle to the export format", async () => {
		const convex = fakeConvex({});
		const doc = JSON.parse(await readDocument(convex, roadmapRef));
		expect(doc.version).toBe(1);
		expect(doc.items[0].laneIndex).toBe(0);
		expect(doc.items[0].startDate).toBe("2026-02-01");
	});

	it("returns the diagram document shape", async () => {
		const convex = fakeConvex({
			query: vi.fn().mockResolvedValue({
				_id: "dg1",
				title: "T",
				type: "mermaid",
				source: "flowchart TD",
				userId: "u",
				visibility: "private",
				archived: false,
			}),
		});
		const doc = JSON.parse(await readDocument(convex, diagramRef));
		expect(doc).toEqual({
			title: "T",
			type: "mermaid",
			source: "flowchart TD",
		});
	});
});

describe("write_document tool", () => {
	function writeTool(
		convex: ConvexHttpClient,
		ref: typeof roadmapRef | typeof diagramRef,
	) {
		const tools = createDocTools(convex, ref);
		const tool = tools.find((t) => t.name === "write_document");
		if (!tool?.execute) throw new Error("write_document tool missing");
		// `execute` is typed optional on the shared `Tool` interface (it's only
		// guaranteed present for tools built via `.server()`), so narrow it here.
		return tool as typeof tool & { execute: NonNullable<typeof tool.execute> };
	}

	it("round-trips a valid roadmap doc into io.replaceRoadmap (version stripped, dates in ms)", async () => {
		const convex = fakeConvex({});
		const tool = writeTool(convex, roadmapRef);
		const document = await readDocument(convex, roadmapRef);
		const result = await tool.execute({ document });
		expect(result.ok).toBe(true);
		const mutation = (convex.mutation as ReturnType<typeof vi.fn>).mock;
		const payload = mutation.calls[0][1].payload;
		expect(payload.version).toBeUndefined();
		expect(payload.items[0].startDate).toBe(D("2026-02-01"));
	});

	it("returns a validation error to the model instead of mutating", async () => {
		const convex = fakeConvex({});
		const tool = writeTool(convex, roadmapRef);
		const doc = JSON.parse(await readDocument(convex, roadmapRef));
		doc.items[0].laneIndex = 9;
		const result = await tool.execute({ document: JSON.stringify(doc) });
		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/laneIndex/);
		expect(convex.mutation).not.toHaveBeenCalled();
	});

	it("writes a valid diagram doc via diagrams.replace", async () => {
		const convex = fakeConvex({});
		const tool = writeTool(convex, diagramRef);
		const result = await tool.execute({
			document: JSON.stringify({
				title: "T",
				type: "plantuml",
				source: "@startuml\n@enduml",
			}),
		});
		expect(result.ok).toBe(true);
		expect(convex.mutation).toHaveBeenCalledTimes(1);
	});

	it("returns Convex errors as tool errors instead of throwing", async () => {
		const convex = fakeConvex({
			mutation: vi.fn().mockRejectedValue(new Error("access denied")),
		});
		const tool = writeTool(convex, diagramRef);
		const result = await tool.execute({
			document: JSON.stringify({ title: "T", type: "mermaid", source: "x" }),
		});
		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/access denied/);
	});
});

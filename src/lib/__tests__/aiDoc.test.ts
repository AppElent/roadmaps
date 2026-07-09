import { describe, expect, it } from "vitest";
import {
	buildSystemPrompt,
	MAX_DOC_CHARS,
	parseDiagramDoc,
	validateRoadmapDoc,
} from "@/lib/aiDoc";
import type { RoadmapExport } from "@/lib/roadmapIO";

const D = (s: string) => new Date(`${s}T00:00:00`).getTime();

function baseDoc(): RoadmapExport {
	return {
		version: 1,
		name: "Test roadmap",
		startDate: D("2026-01-01"),
		endDate: D("2026-12-31"),
		defaultZoom: "month",
		fields: [
			{
				key: "status",
				label: "Status",
				type: "select",
				options: [
					{ id: "todo", label: "To do", color: "#888888" },
					{ id: "done", label: "Done", color: "#22cc66" },
				],
				order: 0,
				showInTable: true,
				isSystem: true,
			},
		],
		lanes: [{ name: "Lane A", order: 0, isDefault: true }],
		items: [
			{
				title: "Item 1",
				laneIndex: 0,
				startDate: D("2026-02-01"),
				endDate: D("2026-03-01"),
				values: { status: "todo" },
				order: 0,
			},
		],
		milestones: [],
		dependencies: [],
	};
}

describe("validateRoadmapDoc", () => {
	it("accepts a valid document", () => {
		expect(validateRoadmapDoc(baseDoc())).toBeNull();
	});

	it("rejects an out-of-range laneIndex", () => {
		const doc = baseDoc();
		doc.items[0].laneIndex = 3;
		expect(validateRoadmapDoc(doc)).toMatch(/laneIndex 3/);
	});

	it("rejects items when there are no lanes", () => {
		const doc = baseDoc();
		doc.lanes = [];
		expect(validateRoadmapDoc(doc)).toMatch(/no lanes/i);
	});

	it("rejects reversed item dates", () => {
		const doc = baseDoc();
		doc.items[0].endDate = D("2026-01-15");
		expect(validateRoadmapDoc(doc)).toMatch(/startDate.*endDate|after/i);
	});

	it("rejects reversed roadmap dates", () => {
		const doc = baseDoc();
		doc.endDate = D("2025-01-01");
		expect(validateRoadmapDoc(doc)).toMatch(/startDate/);
	});

	it("rejects unknown value keys", () => {
		const doc = baseDoc();
		doc.items[0].values = { nope: "x" };
		expect(validateRoadmapDoc(doc)).toMatch(/unknown field key "nope"/);
	});

	it("rejects a select value that is not an option id", () => {
		const doc = baseDoc();
		doc.items[0].values = { status: "shipped" };
		expect(validateRoadmapDoc(doc)).toMatch(/status/);
	});

	it("accepts null values and multiselect arrays of option ids", () => {
		const doc = baseDoc();
		doc.fields.push({
			key: "tags",
			label: "Tags",
			type: "multiselect",
			options: [{ id: "a", label: "A", color: "#000000" }],
			order: 1,
			showInTable: false,
		});
		doc.items[0].values = { status: null, tags: ["a"] };
		expect(validateRoadmapDoc(doc)).toBeNull();
	});

	it("rejects out-of-range dependency indexes and self-dependencies", () => {
		const doc = baseDoc();
		doc.dependencies = [{ predecessorIndex: 0, successorIndex: 5 }];
		expect(validateRoadmapDoc(doc)).toMatch(/dependencies\[0\]/);
		doc.dependencies = [{ predecessorIndex: 0, successorIndex: 0 }];
		expect(validateRoadmapDoc(doc)).toMatch(/itself/);
	});
});

describe("parseDiagramDoc", () => {
	it("parses a valid diagram document", () => {
		const doc = parseDiagramDoc(
			JSON.stringify({ title: "T", type: "mermaid", source: "flowchart TD" }),
		);
		expect(doc.type).toBe("mermaid");
	});

	it("throws on invalid JSON", () => {
		expect(() => parseDiagramDoc("{nope")).toThrow(/Invalid JSON/);
	});

	it("throws on an unknown diagram type", () => {
		expect(() =>
			parseDiagramDoc(JSON.stringify({ title: "T", type: "d2", source: "" })),
		).toThrow(/type/);
	});
});

describe("buildSystemPrompt", () => {
	it("embeds the document and today's date for roadmaps", () => {
		const prompt = buildSystemPrompt("roadmap", '{"name":"R"}', "2026-07-08");
		expect(prompt).toContain('{"name":"R"}');
		expect(prompt).toContain("2026-07-08");
		expect(prompt).toContain("write_document");
		expect(prompt).toContain("laneIndex");
	});

	it("mentions the engine for diagrams", () => {
		const prompt = buildSystemPrompt(
			"diagram",
			'{"type":"plantuml","source":""}',
			"2026-07-08",
		);
		expect(prompt).toContain("PlantUML");
	});
});

describe("MAX_DOC_CHARS", () => {
	it("is 100k", () => {
		expect(MAX_DOC_CHARS).toBe(100_000);
	});
});

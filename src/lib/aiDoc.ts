import { z } from "zod";
import type { RoadmapExport } from "@/lib/roadmapIO";

/** Documents larger than this are refused rather than silently truncated. */
export const MAX_DOC_CHARS = 100_000;

// ---------------------------------------------------------------- diagrams

export const diagramDocSchema = z.object({
	title: z.string().min(1),
	type: z.enum(["mermaid", "plantuml"]),
	source: z.string(),
});

export type DiagramDoc = z.infer<typeof diagramDocSchema>;

/** Parses the AI's diagram document; throws Error with a friendly message. */
export function parseDiagramDoc(text: string): DiagramDoc {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error("Invalid JSON");
	}
	const result = diagramDocSchema.safeParse(raw);
	if (!result.success) {
		const issue = result.error.issues[0];
		const path = issue.path.map(String).join(".") || "(root)";
		throw new Error(`${path}: ${issue.message}`);
	}
	return result.data;
}

// ---------------------------------------------------------------- roadmaps

type ExportField = RoadmapExport["fields"][number];
type ExportValue = RoadmapExport["items"][number]["values"][string];

function checkValue(field: ExportField, value: ExportValue): string | null {
	const optionIds = new Set((field.options ?? []).map((o) => o.id));
	switch (field.type) {
		case "text":
			return typeof value === "string" ? null : "expected a string";
		case "number":
			return typeof value === "number" ? null : "expected a number";
		case "date":
			// parseImport converts "YYYY-MM-DD" strings for date fields to ms.
			return typeof value === "number"
				? null
				: 'expected a date as "YYYY-MM-DD"';
		case "select":
			return typeof value === "string" && optionIds.has(value)
				? null
				: `expected one of the option ids: ${[...optionIds].join(", ")}`;
		case "multiselect":
			return Array.isArray(value) && value.every((v) => optionIds.has(v))
				? null
				: `expected an array of option ids: ${[...optionIds].join(", ")}`;
	}
}

/**
 * Semantic checks parseImport's schema can't express. Returns the first
 * problem as a human/model-readable string, or null when the doc is valid.
 */
export function validateRoadmapDoc(doc: RoadmapExport): string | null {
	if (doc.startDate > doc.endDate) {
		return "Roadmap startDate must be on or before endDate";
	}
	if (doc.lanes.length === 0 && doc.items.length > 0) {
		return "Items exist but no lanes are defined";
	}
	const fieldByKey = new Map(doc.fields.map((f) => [f.key, f]));
	for (const [i, item] of doc.items.entries()) {
		const where = `items[${i}] ("${item.title}")`;
		if (
			!Number.isInteger(item.laneIndex) ||
			item.laneIndex < 0 ||
			item.laneIndex >= doc.lanes.length
		) {
			return `${where}: laneIndex ${item.laneIndex} is out of range (lanes: 0..${doc.lanes.length - 1})`;
		}
		if (item.startDate > item.endDate) {
			return `${where}: startDate is after endDate`;
		}
		for (const [key, value] of Object.entries(item.values)) {
			const field = fieldByKey.get(key);
			if (!field) return `${where}: unknown field key "${key}"`;
			if (value === null) continue;
			const err = checkValue(field, value);
			if (err) return `${where}: value for "${key}" invalid — ${err}`;
		}
	}
	for (const [i, dep] of (doc.dependencies ?? []).entries()) {
		const inRange = (n: number) =>
			Number.isInteger(n) && n >= 0 && n < doc.items.length;
		if (!inRange(dep.predecessorIndex) || !inRange(dep.successorIndex)) {
			return `dependencies[${i}]: item index out of range (items: 0..${doc.items.length - 1})`;
		}
		if (dep.predecessorIndex === dep.successorIndex) {
			return `dependencies[${i}]: an item cannot depend on itself`;
		}
	}
	return null;
}

// ------------------------------------------------------------ system prompt

const ROADMAP_FORMAT_NOTES = `Document format notes:
- "items" reference lanes by array position via "laneIndex" (0-based).
- All dates are "YYYY-MM-DD" strings.
- "items[].values" is keyed by a field's "key"; select/multiselect values are option *ids* (not labels).
- "dependencies" reference items by array position (predecessorIndex/successorIndex).
- Keep "version": 1 and preserve every part of the document you are not changing.`;

export function buildSystemPrompt(
	kind: "roadmap" | "diagram",
	docJson: string,
	today: string,
): string {
	const shared = `You are the ArchStudio assistant, embedded in an editor. Today's date is ${today}.
You can call read_document to re-read the document and write_document to replace it.
write_document replaces the ENTIRE document — always send the complete document, never a fragment. A version checkpoint is saved automatically before every write, so edits are recoverable.
Answer questions about the document directly; make edits by calling write_document. Keep replies short.`;
	if (kind === "roadmap") {
		return `${shared}

The document is a roadmap (JSON).
${ROADMAP_FORMAT_NOTES}

Current document:
${docJson}`;
	}
	return `${shared}

The document is a diagram: JSON with "title", "type" ("mermaid" or "plantuml"), and "source" (the Mermaid or PlantUML code). Write valid source for the document's type — Mermaid syntax for "mermaid", PlantUML (@startuml/@enduml) for "plantuml".

Current document:
${docJson}`;
}

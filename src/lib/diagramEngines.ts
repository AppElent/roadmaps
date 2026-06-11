import type { Doc } from "@convex/_generated/dataModel";

export type DiagramType = Doc<"diagrams">["type"];

export interface DiagramEngine {
	id: DiagramType;
	label: string;
	/** "client-mermaid" renders locally; "kroki" fetches SVG from kroki.io. */
	strategy: "client-mermaid" | "kroki";
	/** Kroki diagram type segment in the URL; required when strategy is "kroki". */
	krokiType?: string;
	/** Debounce before re-rendering after the last keystroke. */
	debounceMs: number;
	/** Source seeded into newly created diagrams. */
	starterSource: string;
}

export const DIAGRAM_ENGINES: Record<DiagramType, DiagramEngine> = {
	mermaid: {
		id: "mermaid",
		label: "Mermaid",
		strategy: "client-mermaid",
		debounceMs: 300,
		starterSource: [
			"flowchart TD",
			"\tA[Start] --> B{Working?}",
			"\tB -->|Yes| C[Ship it]",
			"\tB -->|No| D[Debug]",
			"\tD --> B",
		].join("\n"),
	},
	plantuml: {
		id: "plantuml",
		label: "PlantUML",
		strategy: "kroki",
		krokiType: "plantuml",
		debounceMs: 800,
		starterSource: [
			"@startuml",
			"Alice -> Bob: Hello",
			"Bob --> Alice: Hi!",
			"@enduml",
		].join("\n"),
	},
};

export const DIAGRAM_TYPES = Object.keys(DIAGRAM_ENGINES) as DiagramType[];

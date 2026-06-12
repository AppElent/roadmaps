import type { Seeder } from "./types";

export interface DiagramSeed {
	title: string;
	type: "mermaid" | "plantuml";
	source: string;
	visibility: "private" | "link";
	shareToken?: string;
	archived: boolean;
}

const FLOWCHART = `flowchart TD
  U[User] --> W[Cloudflare Worker]
  W --> Clerk[Clerk Auth]
  W --> C[Convex]
  C --> DB[(Database)]`;

const SEQUENCE_AUTH = `sequenceDiagram
  participant U as User
  participant A as App
  participant C as Clerk
  U->>A: Sign up
  A->>C: Create session
  C-->>A: JWT
  A-->>U: Onboarding`;

const ER = `erDiagram
  ROADMAPS ||--o{ FIELDS : defines
  ROADMAPS ||--o{ LANES : has
  LANES ||--o{ ITEMS : contains
  ROADMAPS ||--o{ MILESTONES : marks`;

const GANTT = `gantt
  title Release Timeline
  dateFormat YYYY-MM-DD
  section Product
  Design system refresh :2026-01-06, 52d
  Realtime collaboration :2026-03-09, 67d
  section GTM
  Pricing & billing :2026-05-04, 60d`;

const PUML_CLASS = `@startuml
class Roadmap {
  +name: string
  +startDate: number
}
class Lane
class Item
Roadmap "1" o-- "many" Lane
Lane "1" o-- "many" Item
@enduml`;

const PUML_SEQUENCE = `@startuml
actor User
User -> App : edit item
App -> Convex : items.update
Convex --> App : real-time snapshot
App --> User : live update
@enduml`;

export const DEMO_DIAGRAMS: DiagramSeed[] = [
	{
		title: "Product architecture overview",
		type: "mermaid",
		source: FLOWCHART,
		visibility: "link",
		shareToken: "d1a9f0c2b3e44d5e6f7a8b9c0d1e2f30",
		archived: false,
	},
	{
		title: "Auth & onboarding flow",
		type: "mermaid",
		source: SEQUENCE_AUTH,
		visibility: "private",
		archived: false,
	},
	{
		title: "Data model",
		type: "mermaid",
		source: ER,
		visibility: "private",
		archived: false,
	},
	{
		title: "Release timeline",
		type: "mermaid",
		source: GANTT,
		visibility: "private",
		archived: false,
	},
	{
		title: "Domain model",
		type: "plantuml",
		source: PUML_CLASS,
		visibility: "private",
		archived: false,
	},
	{
		title: "Realtime collaboration sync",
		type: "plantuml",
		source: PUML_SEQUENCE,
		visibility: "private",
		archived: false,
	},
	{
		// Edge cases: empty draft source + archived.
		title: "Untitled diagram",
		type: "mermaid",
		source: "",
		visibility: "private",
		archived: true,
	},
];

export const diagramSeeder: Seeder = {
	name: "diagrams",
	async wipe(ctx, userId) {
		const diagrams = await ctx.db
			.query("diagrams")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		for (const diagram of diagrams) {
			const versions = await ctx.db
				.query("diagramVersions")
				.withIndex("by_diagram", (q) => q.eq("diagramId", diagram._id))
				.collect();
			for (const version of versions) {
				await ctx.db.delete(version._id);
			}
			await ctx.db.delete(diagram._id);
		}
	},
	async seed(ctx, userId) {
		for (const spec of DEMO_DIAGRAMS) {
			await ctx.db.insert("diagrams", { userId, ...spec });
		}
		return DEMO_DIAGRAMS.length;
	},
};

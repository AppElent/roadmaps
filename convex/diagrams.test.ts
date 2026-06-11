import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const alex = { subject: "user_alex" };
const mallory = { subject: "user_mallory" };

test("create stores the diagram and get returns it", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Auth flow",
		type: "mermaid",
		source: "flowchart TD\n A --> B",
	});
	const diagram = await t
		.withIdentity(alex)
		.query(api.diagrams.get, { diagramId });
	expect(diagram.title).toBe("Auth flow");
	expect(diagram.type).toBe("mermaid");
	expect(diagram.source).toBe("flowchart TD\n A --> B");
	expect(diagram.visibility).toBe("private");
	expect(diagram.archived).toBe(false);
});

test("create defaults source to an empty string", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Blank",
		type: "plantuml",
	});
	const diagram = await t
		.withIdentity(alex)
		.query(api.diagrams.get, { diagramId });
	expect(diagram.source).toBe("");
});

test("list returns only the caller's non-archived diagrams", async () => {
	const t = convexTest(schema, modules);
	await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Mine", type: "mermaid" });
	const archivedId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Old", type: "mermaid" });
	await t
		.withIdentity(mallory)
		.mutation(api.diagrams.create, { title: "Theirs", type: "plantuml" });
	await t.run(async (ctx) => {
		await ctx.db.patch(archivedId, { archived: true });
	});
	const list = await t.withIdentity(alex).query(api.diagrams.list, {});
	expect(list.map((d) => d.title)).toEqual(["Mine"]);
});

test("update patches title, type and source", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Before",
		type: "mermaid",
		source: "flowchart TD\n A --> B",
	});
	await t.withIdentity(alex).mutation(api.diagrams.update, {
		diagramId,
		title: "After",
		source: "flowchart LR\n A --> B",
	});
	const diagram = await t
		.withIdentity(alex)
		.query(api.diagrams.get, { diagramId });
	expect(diagram.title).toBe("After");
	expect(diagram.type).toBe("mermaid");
	expect(diagram.source).toBe("flowchart LR\n A --> B");
});

test("remove deletes the diagram", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Doomed", type: "mermaid" });
	await t.withIdentity(alex).mutation(api.diagrams.remove, { diagramId });
	await expect(
		t.withIdentity(alex).query(api.diagrams.get, { diagramId }),
	).rejects.toThrow(/access denied/);
});

test("a non-owner cannot get, update or remove a diagram", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Private", type: "mermaid" });
	await expect(
		t.withIdentity(mallory).query(api.diagrams.get, { diagramId }),
	).rejects.toThrow(/access denied/);
	await expect(
		t
			.withIdentity(mallory)
			.mutation(api.diagrams.update, { diagramId, title: "Hacked" }),
	).rejects.toThrow(/access denied/);
	await expect(
		t.withIdentity(mallory).mutation(api.diagrams.remove, { diagramId }),
	).rejects.toThrow(/access denied/);
});

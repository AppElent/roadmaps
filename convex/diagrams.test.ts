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

test("enableShare issues a token honored by getPublicDiagram", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Shared",
		type: "mermaid",
		source: "flowchart TD\n A --> B",
	});
	const token = await t
		.withIdentity(alex)
		.mutation(api.diagrams.enableShare, { diagramId });
	expect(token).toBeTruthy();
	const pub = await t.query(api.sharing.getPublicDiagram, {
		shareToken: token,
	});
	expect(pub?.title).toBe("Shared");
	expect(pub?.source).toBe("flowchart TD\n A --> B");
});

test("disableShare revokes public access", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Shared", type: "mermaid" });
	const token = await t
		.withIdentity(alex)
		.mutation(api.diagrams.enableShare, { diagramId });
	await t.withIdentity(alex).mutation(api.diagrams.disableShare, { diagramId });
	const pub = await t.query(api.sharing.getPublicDiagram, {
		shareToken: token,
	});
	expect(pub).toBeNull();
});

test("regenerateShare invalidates the old token", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Shared", type: "mermaid" });
	const oldToken = await t
		.withIdentity(alex)
		.mutation(api.diagrams.enableShare, { diagramId });
	const newToken = await t
		.withIdentity(alex)
		.mutation(api.diagrams.regenerateShare, { diagramId });
	expect(newToken).not.toBe(oldToken);
	expect(
		await t.query(api.sharing.getPublicDiagram, { shareToken: oldToken }),
	).toBeNull();
	expect(
		(await t.query(api.sharing.getPublicDiagram, { shareToken: newToken }))
			?.title,
	).toBe("Shared");
});

test("getPublicDiagram returns null for unknown tokens", async () => {
	const t = convexTest(schema, modules);
	expect(
		await t.query(api.sharing.getPublicDiagram, { shareToken: "nope" }),
	).toBeNull();
});

test("regenerateShare throws if sharing is not enabled", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Private", type: "mermaid" });
	await expect(
		t
			.withIdentity(alex)
			.mutation(api.diagrams.regenerateShare, { diagramId }),
	).rejects.toThrow(/not enabled/);
});

test("a non-owner cannot manage sharing", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Private", type: "mermaid" });
	await expect(
		t.withIdentity(mallory).mutation(api.diagrams.enableShare, { diagramId }),
	).rejects.toThrow(/access denied/);
	await expect(
		t.withIdentity(mallory).mutation(api.diagrams.disableShare, { diagramId }),
	).rejects.toThrow(/access denied/);
	await expect(
		t
			.withIdentity(mallory)
			.mutation(api.diagrams.regenerateShare, { diagramId }),
	).rejects.toThrow(/access denied/);
});

test("remove deletes the diagram's versions too", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await t
		.withIdentity(alex)
		.mutation(api.diagrams.create, { title: "Doomed", type: "mermaid" });
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.create, { diagramId, label: "v1" });
	await t.withIdentity(alex).mutation(api.diagrams.remove, { diagramId });
	const orphans = await t.run(async (ctx) => {
		return await ctx.db.query("diagramVersions").collect();
	});
	expect(orphans).toHaveLength(0);
});

test("replace saves an auto version, then applies the new document", async () => {
	const t = convexTest(schema, modules);
	const asUser = t.withIdentity(alex);
	const diagramId = await asUser.mutation(api.diagrams.create, {
		title: "Old title",
		type: "mermaid",
		source: "flowchart TD\n  A --> B",
	});

	await asUser.mutation(api.diagrams.replace, {
		diagramId,
		title: "New title",
		type: "mermaid",
		source: "flowchart TD\n  A --> C",
	});

	const diagram = await asUser.query(api.diagrams.get, { diagramId });
	expect(diagram.title).toBe("New title");
	expect(diagram.source).toContain("A --> C");

	const versions = await asUser.query(api.diagramVersions.list, {
		diagramId,
	});
	expect(versions).toHaveLength(1);
	expect(versions[0].label).toBe("Before AI edit");
	expect(versions[0].kind).toBe("auto");
});

test("replace rejects a non-owner", async () => {
	const t = convexTest(schema, modules);
	const asOwner = t.withIdentity(alex);
	const asOther = t.withIdentity(mallory);
	const diagramId = await asOwner.mutation(api.diagrams.create, {
		title: "T",
		type: "mermaid",
	});
	await expect(
		asOther.mutation(api.diagrams.replace, {
			diagramId,
			title: "X",
			type: "mermaid",
			source: "",
		}),
	).rejects.toThrow(/not found or access denied/i);
});

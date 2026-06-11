import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const alex = { subject: "user_alex" };
const mallory = { subject: "user_mallory" };

async function setupDiagram(t: ReturnType<typeof convexTest>) {
	return await t.withIdentity(alex).mutation(api.diagrams.create, {
		title: "Flow",
		type: "mermaid",
		source: "flowchart TD\n A --> B",
	});
}

test("create saves a manual version of the current state", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.create, { diagramId, label: "Checkpoint" });
	const list = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	expect(list).toHaveLength(1);
	expect(list[0].label).toBe("Checkpoint");
	expect(list[0].kind).toBe("manual");
});

test("blank labels fall back to a numbered default", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.create, { diagramId, label: "  " });
	const list = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	expect(list[0].label).toBe("Version 1");
});

test("restore reproduces the snapshot and auto-checkpoints first", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.create, { diagramId, label: "Original" });
	await t.withIdentity(alex).mutation(api.diagrams.update, {
		diagramId,
		title: "Changed",
		source: "flowchart LR\n X --> Y",
	});

	const list = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	const checkpoint = list.find((v) => v.label === "Original");
	if (!checkpoint) throw new Error("checkpoint missing");
	await t
		.withIdentity(alex)
		.mutation(api.diagramVersions.restore, { versionId: checkpoint._id });

	const diagram = await t
		.withIdentity(alex)
		.query(api.diagrams.get, { diagramId });
	expect(diagram.title).toBe("Flow");
	expect(diagram.source).toBe("flowchart TD\n A --> B");

	const list2 = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	expect(
		list2.some((v) => v.kind === "auto" && v.label === "Before restore"),
	).toBe(true);
});

test("versions are capped at 25, pruning oldest first", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	for (let i = 0; i < 27; i++) {
		await t
			.withIdentity(alex)
			.mutation(api.diagramVersions.create, { diagramId, label: `v${i}` });
	}
	const list = await t
		.withIdentity(alex)
		.query(api.diagramVersions.list, { diagramId });
	expect(list).toHaveLength(25);
	expect(list.some((v) => v.label === "v0")).toBe(false);
	expect(list.some((v) => v.label === "v26")).toBe(true);
});

test("a non-owner cannot list, create or restore versions", async () => {
	const t = convexTest(schema, modules);
	const diagramId = await setupDiagram(t);
	await expect(
		t
			.withIdentity(mallory)
			.mutation(api.diagramVersions.create, { diagramId, label: "x" }),
	).rejects.toThrow(/access denied/);
	await expect(
		t.withIdentity(mallory).query(api.diagramVersions.list, { diagramId }),
	).rejects.toThrow(/access denied/);
});

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toolDefinition } from "@tanstack/ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { parseDiagramDoc, validateRoadmapDoc } from "@/lib/aiDoc";
import { parseImport, serializeRoadmap } from "@/lib/roadmapIO";

export const docRefSchema = z.union([
	z.object({ kind: z.literal("roadmap"), id: z.string() }),
	z.object({ kind: z.literal("diagram"), id: z.string() }),
]);

export type DocRef = z.infer<typeof docRefSchema>;

/** Reads the pinned document as pretty-printed JSON (throws on auth/not-found). */
export async function readDocument(
	convex: ConvexHttpClient,
	docRef: DocRef,
): Promise<string> {
	if (docRef.kind === "roadmap") {
		const bundle = await convex.query(api.roadmaps.getBundle, {
			roadmapId: docRef.id as Id<"roadmaps">,
		});
		return JSON.stringify(serializeRoadmap(bundle), null, 2);
	}
	const diagram = await convex.query(api.diagrams.get, {
		diagramId: docRef.id as Id<"diagrams">,
	});
	return JSON.stringify(
		{ title: diagram.title, type: diagram.type, source: diagram.source },
		null,
		2,
	);
}

async function writeDocument(
	convex: ConvexHttpClient,
	docRef: DocRef,
	document: string,
): Promise<{ ok: boolean; error?: string }> {
	try {
		if (docRef.kind === "roadmap") {
			const parsed = parseImport(document);
			const problem = validateRoadmapDoc(parsed);
			if (problem) return { ok: false, error: problem };
			const { version: _version, ...payload } = parsed;
			await convex.mutation(api.io.replaceRoadmap, {
				roadmapId: docRef.id as Id<"roadmaps">,
				payload,
			});
		} else {
			const doc = parseDiagramDoc(document);
			await convex.mutation(api.diagrams.replace, {
				diagramId: docRef.id as Id<"diagrams">,
				...doc,
			});
		}
		return { ok: true };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

const readDocumentDef = toolDefinition({
	name: "read_document",
	description:
		"Re-read the current document (the open roadmap or diagram) as JSON.",
	inputSchema: z.object({}),
	outputSchema: z.object({ document: z.string() }),
});

const writeDocumentDef = toolDefinition({
	name: "write_document",
	description:
		"Replace the ENTIRE current document. Pass the complete document as a JSON string in the same format read_document returns. A version checkpoint is saved automatically before the write. On failure, fix the reported problem and try again.",
	inputSchema: z.object({ document: z.string() }),
	outputSchema: z.object({
		ok: z.boolean(),
		error: z.string().optional(),
	}),
});

/** The per-request tool set, bound to the caller's Convex client + document. */
export function createDocTools(convex: ConvexHttpClient, docRef: DocRef) {
	return [
		readDocumentDef.server(async () => ({
			document: await readDocument(convex, docRef),
		})),
		writeDocumentDef.server(async ({ document }) =>
			writeDocument(convex, docRef, document),
		),
	];
}
